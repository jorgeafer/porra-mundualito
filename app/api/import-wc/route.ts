import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchAllWCMatches,
  isTBDTeam,
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
    const allMatches = await fetchAllWCMatches()

    // Solo importar partidos con equipos reales (no TBD ni placeholders)
    const knownMatches = allMatches.filter(
      m => !isTBDTeam(m.homeTeam) && !isTBDTeam(m.awayTeam)
    )

    if (knownMatches.length === 0) {
      return NextResponse.json({ ok: true, teams: 0, inserted: 0, skipped: 0 })
    }

    // 1. Extraer nombres de equipo únicos (normalizados a nuestro mapeado)
    const rawNames = [...new Set([
      ...knownMatches.map(m => m.homeTeam.name),
      ...knownMatches.map(m => m.awayTeam.name),
    ])]

    // Para cada nombre FD, determinar el nombre canónico en DB
    // Si está en FD_NAME_MAP, el canonical es la versión capitalizada del mapeado
    // Si no, usamos el nombre original de FD
    const CANONICAL: Record<string, string> = {}
    for (const fdName of rawNames) {
      const normalized = fdName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const mapped = FD_NAME_MAP[normalized]
      if (mapped) {
        // Capitalize first letter of each word for display
        CANONICAL[fdName] = mapped
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
          // Special cases
          .replace('Usa', 'USA')
          .replace('Uae', 'UAE')
          .replace('Dr ', 'DR ')
      } else {
        CANONICAL[fdName] = fdName
      }
    }

    const canonicalNames = [...new Set(Object.values(CANONICAL))]

    // 2. Derivar código de 3 letras para cada equipo
    function nameToCode(name: string): string {
      // Try TLA from first matched FD team
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

    // 3. Mapear group por equipo canónico
    const teamGroupMap: Record<string, string> = {}
    for (const m of knownMatches) {
      const g = normalizeFDGroup(m.group)
      if (g) {
        const homeName = CANONICAL[m.homeTeam.name]
        const awayName = CANONICAL[m.awayTeam.name]
        if (homeName) teamGroupMap[homeName] = g
        if (awayName) teamGroupMap[awayName] = g
      }
    }

    // 4. Insertar/actualizar equipos
    const seenCodes = new Set<string>()
    const teamsToUpsert = canonicalNames.map(name => {
      let code = nameToCode(name)
      if (seenCodes.has(code)) {
        const base = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
        code = base
        let i = 2
        while (seenCodes.has(code)) code = base.slice(0, 2) + i++
      }
      seenCodes.add(code)
      return {
        name,
        code,
        flag_emoji: null as string | null,
        group_name: teamGroupMap[name] ?? null,
      }
    })

    const { error: teamsError } = await admin
      .from('teams')
      .upsert(teamsToUpsert, { onConflict: 'code' })

    if (teamsError) throw new Error(`Equipos: ${teamsError.message}`)

    // Actualizar group_name de equipos ya existentes (por nombre)
    for (const [name, groupLetter] of Object.entries(teamGroupMap)) {
      await admin.from('teams').update({ group_name: groupLetter }).eq('name', name)
    }

    // 5. Mapa nombre canónico → id
    const { data: allTeams } = await admin.from('teams').select('id, name')
    const byName: Record<string, number> = {}
    for (const t of allTeams ?? []) byName[t.name.toLowerCase()] = t.id

    // 6. Construir partidos a insertar
    const matchesToInsert = knownMatches
      .map(m => {
        const homeCanonical = CANONICAL[m.homeTeam.name]
        const awayCanonical = CANONICAL[m.awayTeam.name]
        if (!homeCanonical || !awayCanonical) return null

        const homeId = byName[homeCanonical.toLowerCase()]
        const awayId = byName[awayCanonical.toLowerCase()]
        if (!homeId || !awayId) return null

        const stage = normalizeFDStage(m.stage)
        const groupLetter = normalizeFDGroup(m.group)

        const isFinished = m.status === 'FINISHED' &&
          m.score.fullTime.home !== null &&
          m.score.fullTime.away !== null

        return {
          home_team_id: homeId,
          away_team_id: awayId,
          match_date: m.utcDate,
          stage,
          group_name: groupLetter,
          venue: m.venue ?? null,
          home_score: isFinished ? m.score.fullTime.home : null,
          away_score: isFinished ? m.score.fullTime.away : null,
          status: (isFinished ? 'finished' : 'scheduled') as 'scheduled' | 'finished',
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    // 7. Solo insertar partidos que aún no existen (no tocar resultados existentes)
    const { data: existingMatches } = await admin
      .from('matches')
      .select('home_team_id, away_team_id')

    const existingPairs = new Set(
      (existingMatches ?? []).map(m => `${m.home_team_id}-${m.away_team_id}`)
    )

    const newMatches = matchesToInsert.filter(
      m => !existingPairs.has(`${m.home_team_id}-${m.away_team_id}`) &&
           !existingPairs.has(`${m.away_team_id}-${m.home_team_id}`)
    )

    if (newMatches.length > 0) {
      const { error: matchesError } = await admin.from('matches').insert(newMatches)
      if (matchesError) throw new Error(`Partidos: ${matchesError.message}`)
    }

    return NextResponse.json({
      ok: true,
      teams: teamsToUpsert.length,
      inserted: newMatches.length,
      skipped: matchesToInsert.length - newMatches.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
