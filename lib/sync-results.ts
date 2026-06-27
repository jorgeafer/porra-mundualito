import { createAdminClient } from './supabase/admin'
import { fetchFinishedMatches, resolveTeamName } from './football-data'
import { calculatePoints } from './scoring'

export interface SyncReport {
  updated: number
  pointsRecalculated: number
  errors: string[]
}

export async function syncResults(): Promise<SyncReport> {
  const supabase = createAdminClient()
  const report: SyncReport = { updated: 0, pointsRecalculated: 0, errors: [] }

  // 1. Obtener partidos terminados de football-data.org
  const finished = await fetchFinishedMatches()
  if (finished.length === 0) return report

  // 2. Mapa nombre de equipo → id en nuestra BD (normalizado, accent-insensitive)
  function normalize(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }

  const { data: teams } = await supabase.from('teams').select('id, name')
  const byName: Record<string, number> = {}
  for (const t of teams ?? []) byName[normalize(t.name)] = t.id

  for (const m of finished) {
    // fetchFinishedMatches ya filtra partidos sin resultado; los nombres pueden ser null
    // en teoría para partidos terminados siempre hay nombre, pero lo guardamos
    if (!m.homeTeam.name || !m.awayTeam.name) continue

    // Intentar casar por name, shortName y tla (normalizando acentos y aplicando alias)
    const homeId = byName[resolveTeamName(m.homeTeam.name)]
      ?? (m.homeTeam.shortName ? byName[resolveTeamName(m.homeTeam.shortName)] : undefined)
      ?? (m.homeTeam.tla ? byName[resolveTeamName(m.homeTeam.tla)] : undefined)
    const awayId = byName[resolveTeamName(m.awayTeam.name)]
      ?? (m.awayTeam.shortName ? byName[resolveTeamName(m.awayTeam.shortName)] : undefined)
      ?? (m.awayTeam.tla ? byName[resolveTeamName(m.awayTeam.tla)] : undefined)

    if (!homeId || !awayId) {
      const hResolved = resolveTeamName(m.homeTeam.name)
      const aResolved = resolveTeamName(m.awayTeam.name)
      console.warn(`[sync-results] equipo no encontrado — home: "${m.homeTeam.name}" (→"${hResolved}") away: "${m.awayTeam.name}" (→"${aResolved}")`)
      continue
    }

    let homeScore = m.score.fullTime.home!
    let awayScore = m.score.fullTime.away!

    // 3. Buscar el partido en BD — probar orden normal y luego invertido
    let { data: match } = await supabase
      .from('matches')
      .select('id, home_score, away_score, status')
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId)
      .single()

    if (!match) {
      // Probar con equipos invertidos (football-data.org puede tener el orden opuesto)
      const { data: reversed } = await supabase
        .from('matches')
        .select('id, home_score, away_score, status')
        .eq('home_team_id', awayId)
        .eq('away_team_id', homeId)
        .single()
      if (reversed) {
        match = reversed
        ;[homeScore, awayScore] = [awayScore, homeScore]
      }
    }

    if (!match) {
      console.warn(`[sync-results] partido no encontrado en BD: "${m.homeTeam.name}" vs "${m.awayTeam.name}"`)
      continue
    }

    // 4. Actualizar resultado solo si ha cambiado
    const alreadyCorrect = match.status === 'finished' && match.home_score === homeScore && match.away_score === awayScore
    if (!alreadyCorrect) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ home_score: homeScore, away_score: awayScore, status: 'finished' })
        .eq('id', match.id)

      if (updateError) {
        report.errors.push(`${m.homeTeam.name} vs ${m.awayTeam.name}: ${updateError.message}`)
        continue
      }
      report.updated++
    }

    // 5. Recalcular puntos siempre (cubre casos donde el resultado ya estaba pero los puntos no)
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, home_score, away_score')
      .eq('match_id', match.id)

    if (!predictions?.length) continue

    for (const p of predictions) {
      const points = calculatePoints(
        { home: p.home_score, away: p.away_score },
        { home: homeScore, away: awayScore }
      )
      await supabase.from('predictions').update({ points }).eq('id', p.id)
      report.pointsRecalculated++
    }
  }

  return report
}
