import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MatchesView from '@/components/matches-view'
import type { MatchWithTeams, Prediction } from '@/types/database'

export default async function PartidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: matches }, { data: myPredictions }] = await Promise.all([
    supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .order('match_date', { ascending: true }),
    supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id),
  ])

  const predictions: Record<number, Prediction> = {}
  for (const p of myPredictions ?? []) predictions[p.match_id] = p

  return (
    <MatchesView
      matches={(matches as MatchWithTeams[]) ?? []}
      predictions={predictions}
      userId={user.id}
    />
  )
}
