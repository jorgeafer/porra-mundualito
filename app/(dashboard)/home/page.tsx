import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import HomeMatchCard from '@/components/home-match-card'
import type { MatchWithTeams } from '@/types/database'

type MyPred = { match_id: number; home_score: number | null; away_score: number | null; points: number }
type AnyPred = { user_id: string; match_id: number; home_score: number | null; away_score: number | null; points: number }

export default async function LobbyPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: matches },
    { data: allPredictions },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .order('match_date', { ascending: true }),
    admin.from('predictions').select('user_id, match_id, home_score, away_score, points'),
    supabase.from('profiles').select('id, username, display_name'),
  ])

  const allMatches = (matches as MatchWithTeams[]) ?? []
  const preds = (allPredictions ?? []) as AnyPred[]

  // Índices útiles
  const predMap = new Map<number, MyPred>()
  for (const p of preds.filter(p => p.user_id === user.id)) predMap.set(p.match_id, p)

  const profileNames: Record<string, string> = {}
  for (const p of profiles ?? []) profileNames[p.id] = p.display_name ?? p.username

  // matchId → predicciones de todos los usuarios
  const predsByMatch = new Map<number, AnyPred[]>()
  for (const p of preds) {
    if (p.home_score == null || p.away_score == null) continue
    const arr = predsByMatch.get(p.match_id) ?? []
    arr.push(p)
    predsByMatch.set(p.match_id, arr)
  }

  const now = Date.now()
  const in24h = now + 24 * 60 * 60 * 1000

  const upcomingMatches = allMatches.filter(m => m.status === 'scheduled').slice(0, 10)

  const urgentCount = allMatches.filter(
    m => m.status === 'scheduled' &&
      !predMap.has(m.id) &&
      new Date(m.match_date).getTime() <= in24h
  ).length

  const scheduledIds = allMatches.filter(m => m.status === 'scheduled').map(m => m.id)
  const pendingCount = scheduledIds.filter(id => !predMap.has(id)).length

  const myTotal = preds.filter(p => p.user_id === user.id).reduce((s, p) => s + p.points, 0)

  const pointsByUser: Record<string, number> = {}
  for (const p of preds) pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + p.points
  const sortedPlayers = Object.entries(pointsByUser).sort((a, b) => b[1] - a[1])
  const myRank = sortedPlayers.findIndex(([id]) => id === user.id) + 1
  const totalPlayers = (profiles ?? []).length

  return (
    <div className="space-y-5">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold">
          Hola, {profile?.display_name ?? profile?.username} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Mundial 2026</p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{myTotal}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Puntos</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">
            {myRank > 0 ? `${myRank}º` : '–'}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">de {totalPlayers}</p>
        </div>
        <div className={`rounded-2xl shadow-sm p-4 text-center ${urgentCount > 0 ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white ring-1 ring-slate-100'}`}>
          <p className={`text-2xl font-bold ${urgentCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {pendingCount}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Pendientes</p>
        </div>
      </div>

      {/* Alerta urgente */}
      {urgentCount > 0 && (
        <Link href="/partidos" className="flex items-center gap-3 bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition-colors">
          <span className="text-2xl">⚡</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {urgentCount === 1 ? '1 partido cierra en menos de 24h' : `${urgentCount} partidos cierran en menos de 24h`}
            </p>
            <p className="text-xs text-amber-600">Toca para pronosticar →</p>
          </div>
        </Link>
      )}

      {/* Próximos 5 partidos */}
      {upcomingMatches.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Próximos partidos</p>
          <div className="space-y-3">
            {upcomingMatches.map((match, i) => {
              const pred = predMap.get(match.id) ?? null
              const matchPreds = predsByMatch.get(match.id) ?? []
              const otherPreds = matchPreds.filter(p => p.user_id !== user.id)
              return (
                <HomeMatchCard
                  key={match.id}
                  match={match}
                  prediction={pred}
                  otherPreds={otherPreds}
                  profileNames={profileNames}
                  userId={user.id}
                  isFirst={i === 0}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/partidos" className="bg-emerald-600 text-white rounded-2xl shadow-sm p-4 font-semibold text-sm hover:bg-emerald-700 transition-colors text-center">
          Ver todos los partidos
        </Link>
        <Link href="/clasificacion" className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 font-semibold text-sm hover:bg-slate-50 transition-colors text-center text-slate-700">
          Clasificación
        </Link>
      </div>
    </div>
  )
}
