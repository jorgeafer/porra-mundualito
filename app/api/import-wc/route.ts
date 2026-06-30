import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchAllWCMatches,
  filterKnownMatches,
  normalizeFDStage,
  normalizeFDGroup,
  FD_NAME_MAP,
} from '@/lib/football-data'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Solo admins pueden importar' }, { status: 403 })
  }

  const admin = createAdminClient()

  try {
    // 0. Eliminar equipos duplicados por nombre (mismo nombre, distinto código)
    //    Ocurre cuando el código de OpenFootball difiere del TLA de football-data.org.
    //    Se conserva el equipo con ID más bajo (el original) y se borran los nuevos.
    const { data: allTeamsRaw } = await admin.from('teams').select('id, name')
    const nameToIds: Record<string, number[]> = {}
    for (const t of allTeamsRaw ?? []) {
      const key = t.name.toLowerCase()
      if (!nameToIds[key]) nameToIds[key] = []
      nameToIds[key].push(t.id)
    }
    let duplicatesRemoved = 0
    for (const ids of Object.values(nameToIds)) {
      if (ids.length <= 1) continue
      ids.sort((a, b) => a - b)
      const toDelete = ids.slice(1) // eliminar todos excepto el de ID más bajo
      for (const deleteId of toDelete) {
        await admin.from('matches').delete()
          .or(`home_team_id.eq.${deleteId},away_team_id.eq.${deleteId}`)
      }
      await admin.from('teams').delete().in('id', toDelete)
      duplicatesRemoved += toDelete.length
    }

    // 1. Obtener partidos de football-data.org
    const allMatches = await fetchAllWCMatches()
    const knownMatches = filterKnownMatches(allMatches)

    if (knownMatches.length === 0) {
      return NextResponse.json({ ok: true, teams: 0, inserted: 0, skipped: 0, duplicatesRemoved })
    }

    // 2. Nombres únicos y mapa FD → canónico (nombre en nuestra BD)
    const rawNames = [...new Set([
      ...knownMatches.map(m => m.homeTeam.name),
      ...knownMatches.map(m => m.awayTeam.name),
    ])]

    const CANONICAL: Record<string, string> = {}
    for (const fdName of rawNames) {
      const normalized = fdName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const mapped = FD_NAME_MAP[normalized]
      if (mapped) {
        CANONICAL[fdName] = mapped
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
          .replace('Usa', 'USA')
          .replace('Uae', 'UAE')
          .replace('Dr ', 'DR ')
      } else {
        CANONICAL[fdName] = fdName
      }
    }

    const canonicalNames = [...new Set(Object.values(CANONICAL))]

    // 3. Mapa grupo por equipo canónico
    const teamGroupMap: Record<string, string> = {}
    for (const m of knownMatches) {
      const g = normalizeFDGroup(m.group)
      if (g) {
        teamGroupMap[CANONICAL[m.homeTeam.name]] = g
        teamGroupMap[CANONICAL[m.awayTeam.name]] = g
      }
    }

    // 4. Insertar solo equipos que no existen por nombre (sin tocar los existentes)
    const { data: existingTeamsData } = await admin.from('teams').select('id, name, code')
    const existingByName = new Set((existingTeamsData ?? []).map(t => t.name.toLowerCase()))

    // Derivar código de 3 letras (preferir TLA de football-data.org)
    function nameToCode(name: string): string {
      const fdTeam = knownMatches
        .flatMap(m => [
          { fdName: m.homeTeam.name, tla: m.homeTeam.tla },
          { fdName: m.awayTeam.name, tla: m.awayTeam.tla },
        ])
        .find(t => CANONICAL[t.fdName] === name)
      if (fdTeam?.tla && /^[A-Z]{3}$/.test(fdTeam.tla)) return fdTeam.tla

      const words = name.trim().split(/\s+/)
      if (words.length === 1) return name.slice(0, 3).toUpperCase()
      if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase()
      return words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
    }

    const seenCodes = new Set<string>((existingTeamsData ?? []).map(t => t.code as string))
    const newTeams = canonicalNames
      .filter(name => !existingByName.has(name.toLowerCase()))
      .map(name => {
        let code = nameToCode(name)
        if (seenCodes.has(code)) {
          const base = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
          code = base
          let i = 2
          while (seenCodes.has(code)) code = base.slice(0, 2) + i++
        }
        seenCodes.add(code)
        return { name, code, flag_emoji: null as string | null, group_name: teamGroupMap[name] ?? null }
      })

    if (newTeams.length > 0) {
      const { error: teamsError } = await admin.from('teams').insert(newTeams)
      if (teamsError) throw new Error(`Equipos: ${teamsError.message}`)
    }

    // Actualizar group_name en equipos ya existentes
    for (const [name, groupLetter] of Object.entries(teamGroupMap)) {
      await admin.from('teams').update({ group_name: groupLetter }).eq('name', name)
    }

    // 5. Mapa nombre canónico → id (tras todas las inserciones)
    const { data: allTeams } = await admin.from('teams').select('id, name')
    const byName: Record<string, number> = {}
    for (const t of allTeams ?? []) byName[t.name.toLowerCase()] = t.id

    // 6. Construir partidos
    const missingTeams: string[] = []
    const matchesToInsert = knownMatches
      .map(m => {
        const homeCanonical = CANONICAL[m.homeTeam.name]
        const awayCanonical = CANONICAL[m.awayTeam.name]
        const homeId = byName[homeCanonical.toLowerCase()]
        const awayId = byName[awayCanonical.toLowerCase()]
        if (!homeId || !awayId) {
          missingTeams.push(`${m.homeTeam.name}(${homeCanonical})=${homeId ?? 'NOT FOUND'} vs ${m.awayTeam.name}(${awayCanonical})=${awayId ?? 'NOT FOUND'}`)
          return null
        }

        const isFinished = m.status === 'FINISHED' &&
          m.score.fullTime.home !== null &&
          m.score.fullTime.away !== null

        // extraTime = goles en prórroga (no acumulado). Marcador final = fullTime + extraTime.
        const et = m.score.extraTime
        const homeResult = m.score.fullTime.home! + (et?.home ?? 0)
        const awayResult = m.score.fullTime.away! + (et?.away ?? 0)

        return {
          home_team_id: homeId,
          away_team_id: awayId,
          match_date: m.utcDate,
          stage: normalizeFDStage(m.stage),
          group_name: normalizeFDGroup(m.group),
          venue: m.venue ?? null,
          home_score: isFinished ? homeResult : null,
          away_score: isFinished ? awayResult : null,
          status: (isFinished ? 'finished' : 'scheduled') as 'scheduled' | 'finished',
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    // 7. Dedup y corrección de stage en partidos existentes
    const { data: existingMatches } = await admin
      .from('matches')
      .select('id, home_team_id, away_team_id, stage')

    const existingByPair = new Map(
      (existingMatches ?? []).map(m => [`${m.home_team_id}-${m.away_team_id}`, m])
    )
    // También índice invertido para partidos con equipos en orden opuesto
    const existingByPairReversed = new Map(
      (existingMatches ?? []).map(m => [`${m.away_team_id}-${m.home_team_id}`, m])
    )

    let stageFixed = 0
    const skippedMatches: string[] = []
    const newMatches = matchesToInsert.filter(m => {
      const existing = existingByPair.get(`${m.home_team_id}-${m.away_team_id}`)
        ?? existingByPairReversed.get(`${m.home_team_id}-${m.away_team_id}`)
      if (existing) {
        const home = allTeams?.find(t => t.id === m.home_team_id)?.name ?? m.home_team_id
        const away = allTeams?.find(t => t.id === m.away_team_id)?.name ?? m.away_team_id
        skippedMatches.push(`${home} vs ${away}`)
        // Corregir stage si está mal (ej. round_of_32 que se guardó como 'group')
        if (existing.stage !== m.stage) {
          admin.from('matches').update({ stage: m.stage, group_name: m.group_name })
            .eq('id', existing.id)
            .then(() => { stageFixed++ })
        }
        return false
      }
      return true
    })

    if (newMatches.length > 0) {
      const { error: matchesError } = await admin.from('matches').insert(newMatches)
      if (matchesError) throw new Error(`Partidos: ${matchesError.message}`)
    }

    return NextResponse.json({
      ok: true,
      duplicatesRemoved,
      newTeams: newTeams.length,
      inserted: newMatches.length,
      skippedMatches,
      stageFixed,
      missingTeams,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
