import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ResultForm from '@/components/result-form'
import type { MatchWithTeams } from '@/types/database'

const STAGE_LABELS: Record<string, string> = {
  group: 'Fase de grupos',
  round_of_16: 'Octavos de final',
  quarter: 'Cuartos de final',
  semi: 'Semifinales',
  third_place: 'Tercer y cuarto puesto',
  final: 'Final',
}

export default async function ResultadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/partidos')

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
    .order('match_date', { ascending: true })

  const byStage = Object.groupBy(matches as MatchWithTeams[] ?? [], m => m.stage)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Admin — Resultados</h1>
        <p className="text-sm text-gray-500 mb-8">
          Introduce el marcador final. Los puntos se calcularán automáticamente.
        </p>

        {Object.entries(byStage).map(([stage, stageMatches]) => (
          <section key={stage} className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {STAGE_LABELS[stage] ?? stage}
            </h2>
            <div className="space-y-2">
              {(stageMatches ?? []).map(match => (
                <ResultForm key={match.id} match={match} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
