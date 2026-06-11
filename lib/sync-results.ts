import { createAdminClient } from './supabase/admin'
import { fetchFinishedMatches } from './football-data'
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

  // 2. Mapa nombre de equipo → id en nuestra BD (con variantes de nombre)
  const { data: teams } = await supabase.from('teams').select('id, name')
  const byName: Record<string, number> = {}
  for (const t of teams ?? []) byName[t.name.toLowerCase()] = t.id

  for (const m of finished) {
    // Intentar casar por name, shortName y tla
    const homeId = byName[m.homeTeam.name.toLowerCase()]
      ?? byName[m.homeTeam.shortName.toLowerCase()]
      ?? byName[m.homeTeam.tla.toLowerCase()]
    const awayId = byName[m.awayTeam.name.toLowerCase()]
      ?? byName[m.awayTeam.shortName.toLowerCase()]
      ?? byName[m.awayTeam.tla.toLowerCase()]
    if (!homeId || !awayId) continue

    const homeScore = m.score.fullTime.home!
    const awayScore = m.score.fullTime.away!

    // 3. Buscar el partido en BD
    const { data: match } = await supabase
      .from('matches')
      .select('id, home_score, away_score, status')
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId)
      .single()

    if (!match) continue

    // Saltar si ya tiene el resultado correcto
    if (match.status === 'finished' && match.home_score === homeScore && match.away_score === awayScore) continue

    // 4. Actualizar resultado
    const { error: updateError } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: 'finished' })
      .eq('id', match.id)

    if (updateError) {
      report.errors.push(`${m.homeTeam.name} vs ${m.awayTeam.name}: ${updateError.message}`)
      continue
    }
    report.updated++

    // 5. Recalcular puntos de todas las predicciones de este partido
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
