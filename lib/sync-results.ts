import { createAdminClient } from './supabase/admin'
import { fetchFinishedMatches } from './football-data'
import { calculatePoints } from './scoring'

export interface SyncReport {
  updated: number
  pointsRecalculated: number
  errors: string[]
}

// Nombres que football-data.org usa de forma distinta a nuestra BD
const FD_NAME_MAP: Record<string, string> = {
  'méxico': 'mexico',
  'korea republic': 'south korea',
  'ir iran': 'iran',
  'usa': 'united states',
  'côte d\'ivoire': 'ivory coast',
  'china pr': 'china',
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // elimina acentos
}

function resolveTeamName(name: string): string {
  const n = normalize(name)
  return FD_NAME_MAP[n] ?? n
}

export async function syncResults(): Promise<SyncReport> {
  const supabase = createAdminClient()
  const report: SyncReport = { updated: 0, pointsRecalculated: 0, errors: [] }

  // 1. Obtener partidos terminados de football-data.org
  const finished = await fetchFinishedMatches()
  if (finished.length === 0) return report

  // 2. Mapa nombre de equipo → id en nuestra BD
  const { data: teams } = await supabase.from('teams').select('id, name')
  const byName: Record<string, number> = {}
  for (const t of teams ?? []) byName[normalize(t.name)] = t.id

  for (const m of finished) {
    // Intentar casar por name, shortName y tla (normalizando acentos y aplicando alias)
    const homeId = byName[resolveTeamName(m.homeTeam.name)]
      ?? byName[resolveTeamName(m.homeTeam.shortName)]
      ?? byName[resolveTeamName(m.homeTeam.tla)]
    const awayId = byName[resolveTeamName(m.awayTeam.name)]
      ?? byName[resolveTeamName(m.awayTeam.shortName)]
      ?? byName[resolveTeamName(m.awayTeam.tla)]

    if (!homeId || !awayId) {
      console.warn(`[sync-results] equipo no encontrado: "${m.homeTeam.name}" o "${m.awayTeam.name}"`)
      continue
    }

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
