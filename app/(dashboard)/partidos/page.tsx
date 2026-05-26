import { createClient } from '@/lib/supabase/server'
import PredictionCard from '@/components/prediction-card'
import type { MatchWithTeams, Prediction } from '@/types/database'

const STAGE_LABELS: Record<string, string> = {
  group: 'Fase de grupos',
  round_of_16: 'Octavos de final',
  quarter: 'Cuartos de final',
  semi: 'Semifinales',
  third_place: 'Tercer y cuarto puesto',
  final: 'Final',
}

const STAGE_ORDER = ['group', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

export default async function PartidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: matches }, { data: myPredictions }] = await Promise.all([
    supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .order('match_date', { ascending: true }),
    supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user!.id),
  ])

  const predictionsMap = new Map<number, Prediction>(
    (myPredictions ?? []).map(p => [p.match_id, p])
  )

  // Group matches by stage
  const byStage = STAGE_ORDER.reduce<Record<string, MatchWithTeams[]>>((acc, stage) => {
    const stageMatches = (matches as MatchWithTeams[] ?? []).filter(m => m.stage === stage)
    if (stageMatches.length > 0) acc[stage] = stageMatches
    return acc
  }, {})

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Partidos</h1>
      {Object.entries(byStage).map(([stage, stageMatches]) => (
        <section key={stage} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {STAGE_LABELS[stage] ?? stage}
          </h2>
          <div className="space-y-3">
            {stageMatches.map(match => (
              <PredictionCard
                key={match.id}
                match={match}
                prediction={predictionsMap.get(match.id) ?? null}
                userId={user!.id}
              />
            ))}
          </div>
        </section>
      ))}
      {Object.keys(byStage).length === 0 && (
        <p className="text-gray-500 text-center py-16">Todavía no hay partidos cargados.</p>
      )}
    </div>
  )
}
