import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { flagUrlForTeam, translateTeam } from '@/lib/flags'
import type { MatchWithTeams } from '@/types/database'

function formatDate(iso: string) {
  const utc = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  }).format(new Date(utc))
}

function TeamFlag({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const url = flagUrlForTeam(name)
  const cls = size === 'sm' ? 'w-7 h-5' : 'w-9 h-6'
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} className={`${cls} object-cover rounded shadow-sm`} />
}

type MyPred = { match_id: number; home_score: number | null; away_score: number | null; points: number }
type AnyPred = { user_id: string; match_id: number; home_score: number | null; away_score: number | null; points: number }

export default async function LobbyPage() {
  const supabase = await createClient()
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
    supabase.from('predictions').select('user_id, match_id, home_score, away_score, points'),
    supabase.from('profiles').select('id, username, display_name'),
  ])

  const allMatches = (matches as MatchWithTeams[]) ?? []
  const preds = (allPredictions ?? []) as AnyPred[]

  // Índices útiles
  const predMap = new Map<number, MyPred>()
  for (const p of preds.filter(p => p.user_id === user.id)) predMap.set(p.match_id, p)

  const profileMap = new Map<string, string>()
  for (const p of profiles ?? []) profileMap.set(p.id, p.display_name ?? p.username)

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

  const upcomingMatches = allMatches.filter(m => m.status === 'scheduled').slice(0, 5)

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
              const pred = predMap.get(match.id)
              const hasPred = pred?.home_score != null && pred?.away_score != null
              const isFirst = i === 0
              const matchPreds = predsByMatch.get(match.id) ?? []
              const otherPreds = matchPreds.filter(p => p.user_id !== user.id)
              return (
                <div
                  key={match.id}
                  className={`bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 ${isFirst ? 'ring-1 ring-green-200 border-green-200' : ''}`}
                >
                  {isFirst && (
                    <p className="text-xs font-semibold text-green-600 mb-2">Siguiente</p>
                  )}
                  <div className="flex items-center gap-2">
                    {/* Home team */}
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <TeamFlag name={match.home_team.name} size="sm" />
                      <p className="text-xs font-semibold text-center truncate w-full text-center leading-tight">
                        {translateTeam(match.home_team.name)}
                      </p>
                    </div>

                    {/* Middle: my prediction or VS */}
                    <div className="flex flex-col items-center shrink-0 px-1 min-w-[72px]">
                      {hasPred ? (
                        <div className="flex items-center gap-1">
                          <span className="w-8 h-8 flex items-center justify-center bg-green-50 border border-green-200 rounded-lg text-sm font-bold text-green-700">
                            {pred!.home_score}
                          </span>
                          <span className="text-gray-300 font-bold text-sm">–</span>
                          <span className="w-8 h-8 flex items-center justify-center bg-green-50 border border-green-200 rounded-lg text-sm font-bold text-green-700">
                            {pred!.away_score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 font-bold tracking-widest">VS</span>
                      )}
                      {match.group_name && (
                        <span className="text-xs text-gray-300 mt-0.5">Gr. {match.group_name}</span>
                      )}
                    </div>

                    {/* Away team */}
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <TeamFlag name={match.away_team.name} size="sm" />
                      <p className="text-xs font-semibold text-center truncate w-full text-center leading-tight">
                        {translateTeam(match.away_team.name)}
                      </p>
                    </div>
                  </div>

                  {/* Pronósticos de otros */}
                  {otherPreds.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-50 flex flex-wrap gap-x-3 gap-y-1">
                      {otherPreds.map(p => (
                        <span key={p.user_id} className="text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{profileMap.get(p.user_id) ?? '?'}</span>
                          {' '}{p.home_score}–{p.away_score}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-between ${otherPreds.length > 0 ? 'mt-2' : 'mt-3 pt-2 border-t border-gray-50'}`}>
                    <p className="text-xs text-gray-400 capitalize">{formatDate(match.match_date)}</p>
                    {hasPred ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Pronosticado</span>
                    ) : (
                      <Link href="/partidos" className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-700">
                        Pronosticar →
                      </Link>
                    )}
                  </div>
                </div>
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
