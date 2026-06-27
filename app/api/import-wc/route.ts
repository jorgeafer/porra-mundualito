import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchOFMatches,
  nameToCode,
  isQualifierCode,
  normalizeOFStage,
} from '@/lib/openfootball'

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

  try {
    const allMatches = await fetchOFMatches()

    // Solo importar partidos con equipos reales (no códigos de clasificación)
    const knownMatches = allMatches.filter(
      m => !isQualifierCode(m.team1) && !isQualifierCode(m.team2)
    )

    // 1. Extraer equipos únicos de los partidos de grupos
    const teamNames = [...new Set([
      ...knownMatches.map(m => m.team1),
      ...knownMatches.map(m => m.team2),
    ])]

    // Deduplicar por código — si hay colisión usar primeras 3 letras únicas del nombre completo
    const seenCodes = new Set<string>()
    const teamsToInsert = teamNames.map(name => {
      let code = nameToCode(name)
      if (seenCodes.has(code)) {
        const base = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
        code = base
        let i = 2
        while (seenCodes.has(code)) code = base.slice(0, 2) + i++
      }
      seenCodes.add(code)
      return { name, code, flag_emoji: null as string | null, group_name: null as string | null }
    })

    const { error: teamsError } = await supabase
      .from('teams')
      .upsert(teamsToInsert, { onConflict: 'code' })

    if (teamsError) throw new Error(`Equipos: ${teamsError.message}`)

    // 2. Mapa nombre → id
    const { data: allTeams } = await supabase.from('teams').select('id, name')
    const byName: Record<string, number> = {}
    for (const t of allTeams ?? []) byName[t.name.toLowerCase()] = t.id

    // 3. Construir partidos
    const matchesToInsert = knownMatches
      .map(m => {
        const homeId = byName[m.team1.toLowerCase()]
        const awayId = byName[m.team2.toLowerCase()]
        if (!homeId || !awayId) return null

        // "13:00 UTC-6" → convertir a UTC, manejando desbordamiento de día
        let dateStr = `${m.date}T00:00:00Z`
        if (m.time) {
          const timeMatch = m.time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)?$/)
          if (timeMatch) {
            const h = parseInt(timeMatch[1], 10)
            const min = parseInt(timeMatch[2], 10)
            const offset = parseInt(timeMatch[3] ?? '0', 10)
            let utcH = h - offset
            const d = new Date(`${m.date}T00:00:00Z`)
            if (utcH >= 24) { utcH -= 24; d.setUTCDate(d.getUTCDate() + 1) }
            else if (utcH < 0) { utcH += 24; d.setUTCDate(d.getUTCDate() - 1) }
            const utcDate = d.toISOString().slice(0, 10)
            dateStr = `${utcDate}T${String(utcH).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`
          }
        }

        // "Group A" → "A"
        const groupLetter = m.group?.replace(/^Group\s*/i, '').trim().slice(0, 1).toUpperCase() ?? null

        return {
          home_team_id: homeId,
          away_team_id: awayId,
          match_date: dateStr,
          stage: normalizeOFStage(m.round),
          group_name: groupLetter,
          venue: m.ground ?? null,
          home_score: m.score?.ft[0] ?? null,
          away_score: m.score?.ft[1] ?? null,
          status: (m.score ? 'finished' : 'scheduled') as 'scheduled' | 'finished',
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    // 4. Asignar group_name a cada equipo a partir de sus partidos de grupo
    const teamGroups: Record<string, string> = {}
    for (const m of knownMatches) {
      const g = m.group?.replace(/^Group\s*/i, '').trim().slice(0, 1).toUpperCase()
      if (g) { teamGroups[m.team1] = g; teamGroups[m.team2] = g }
    }
    for (const [name, groupLetter] of Object.entries(teamGroups)) {
      await supabase.from('teams').update({ group_name: groupLetter }).eq('name', name)
    }

    // 5. Borrar partidos con equipos sin nombre real (códigos de clasificación como W74, L3)
    const { data: allTeamsInDB } = await supabase.from('teams').select('id, name')
    const qualifierTeamIds = (allTeamsInDB ?? [])
      .filter(t => /^\d[A-Z](\/[A-Z])*$/.test(t.name))  // e.g. 2A, 1B, 3A/B/C/D/F
      .map(t => t.id)

    if (qualifierTeamIds.length > 0) {
      await supabase
        .from('matches')
        .delete()
        .or(
          qualifierTeamIds.map(id => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(',')
        )
      await supabase.from('teams').delete().in('id', qualifierTeamIds)
    }

    // 6. Solo insertar partidos que aún no existen en BD (por combinación de equipos)
    // No tocar partidos ya jugados ni sus resultados
    const { data: existingMatches } = await supabase
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
      const { error: matchesError } = await supabase.from('matches').insert(newMatches)
      if (matchesError) throw new Error(`Partidos: ${matchesError.message}`)
    }

    return NextResponse.json({
      ok: true,
      teams: teamsToInsert.length,
      inserted: newMatches.length,
      skipped: matchesToInsert.length - newMatches.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
