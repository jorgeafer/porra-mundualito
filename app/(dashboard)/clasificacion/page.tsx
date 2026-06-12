import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RankingHistory from '@/components/ranking-history'

const STAGE_LABELS: Record<string, string> = {
  group: 'Grupos', round_of_32: 'R32', round_of_16: 'Octavos',
  quarter: 'Cuartos', semi: 'Semis', third_place: '3º/4º', final: 'Final',
}
const STAGE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

type StagePoints = Record<string, number>

type RankedPlayer = {
  id: string
  username: string
  display_name: string | null
  total: number
  correct_results: number
  exact_scores: number
  byStage: StagePoints
  rank: number
  rankChange: number | null
}

export default async function ClasificacionPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await admin.from('profiles').select('id, username, display_name')

  // Fetch predictions joined with match stage
  const { data: predictions } = await admin
    .from('predictions')
    .select('user_id, points, match:matches!match_id(stage, status, match_date)')

  type PredRow = { user_id: string; points: number; match: { stage: string; status: string; match_date: string } | null }
  const allPreds = (predictions ?? []) as unknown as PredRow[]

  // History data — must be computed before leaderboard to derive rank changes
  const finishedPreds = allPreds
    .filter(p => p.match?.status === 'finished')
    .sort((a, b) => new Date(a.match!.match_date).getTime() - new Date(b.match!.match_date).getTime())

  const dates = [...new Set(finishedPreds.map(p => p.match!.match_date.slice(0, 10)))].sort()
  const cumulative: Record<string, number> = {}
  const historyData: Array<{ date: string } & Record<string, number>> = []

  let predsIdx = 0
  for (const date of dates) {
    while (predsIdx < finishedPreds.length && finishedPreds[predsIdx].match!.match_date.slice(0, 10) <= date) {
      const { user_id, points } = finishedPreds[predsIdx]
      cumulative[user_id] = (cumulative[user_id] ?? 0) + points
      predsIdx++
    }
    const rankAt: Record<string, number> = {}
    const sorted = Object.entries(cumulative).sort((a, b) => b[1] - a[1])
    sorted.forEach(([uid], i) => { rankAt[uid] = i + 1 })
    historyData.push({ date, ...rankAt } as { date: string } & Record<string, number>)
  }

  const prevSnapshot = historyData.length >= 2 ? historyData[historyData.length - 2] : null

  const statsByUser = new Map<string, { total: number; correct: number; exact: number; byStage: StagePoints }>()
  for (const p of allPreds) {
    const match = p.match
    if (!match) continue
    const cur = statsByUser.get(p.user_id) ?? { total: 0, correct: 0, exact: 0, byStage: {} }
    cur.total += p.points
    if (p.points > 0) cur.correct++
    if (p.points === 4) cur.exact++
    cur.byStage[match.stage] = (cur.byStage[match.stage] ?? 0) + p.points
    statsByUser.set(p.user_id, cur)
  }

  const leaderboard: RankedPlayer[] = (profiles ?? [])
    .map(p => ({
      ...p,
      total: statsByUser.get(p.id)?.total ?? 0,
      correct_results: statsByUser.get(p.id)?.correct ?? 0,
      exact_scores: statsByUser.get(p.id)?.exact ?? 0,
      byStage: statsByUser.get(p.id)?.byStage ?? {},
      rank: 0,
      rankChange: null as number | null,
    }))
    .sort((a, b) => b.total - a.total || b.exact_scores - a.exact_scores)
    .map((e, i) => {
      const rank = i + 1
      const prevRank = prevSnapshot ? (prevSnapshot[e.id] as number | undefined) : undefined
      return { ...e, rank, rankChange: prevRank != null ? prevRank - rank : null }
    })

  const activeStages = STAGE_ORDER.filter(s => leaderboard.some(e => (e.byStage[s] ?? 0) > 0))

  const playerNames: Record<string, string> = {}
  for (const p of profiles ?? []) playerNames[p.id] = p.display_name ?? p.username

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clasificación</h1>

      {leaderboard.length === 0 && (
        <p className="text-center text-slate-400 py-10">Nadie ha hecho predicciones aún.</p>
      )}

      {/* Podio top 4 */}
      {leaderboard.length > 0 && (
        <div className="mb-6">
          <div className="flex items-end justify-center gap-2">

            {/* 2º */}
            {leaderboard[1] && (
              <div className="flex flex-col items-center flex-1">
                <span className="text-xl mb-1">🥈</span>
                <Link href={`/clasificacion/${leaderboard[1].id}`} className="flex flex-col items-center group mb-2">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white ring-2 ring-slate-300 mb-1 ${leaderboard[1].id === user!.id ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-400'}`}>
                    {(leaderboard[1].display_name ?? leaderboard[1].username).slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-slate-700 text-center leading-tight truncate w-full max-w-[80px] group-hover:text-emerald-700">
                    {leaderboard[1].display_name ?? leaderboard[1].username}
                    {leaderboard[1].id === user!.id && <span className="text-emerald-600"> (tú)</span>}
                  </p>
                </Link>
                <div className="bg-slate-200 rounded-t-2xl w-full h-20 flex flex-col items-center justify-center">
                  <span className="text-slate-600 font-bold text-2xl leading-none">{leaderboard[1].total}</span>
                  <span className="text-slate-400 text-xs font-semibold mt-0.5">pts</span>
                </div>
              </div>
            )}

            {/* 1º */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-2xl mb-1">👑</span>
              <Link href={`/clasificacion/${leaderboard[0].id}`} className="flex flex-col items-center group mb-2">
                <div className={`w-13 h-13 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ring-4 ring-amber-300 shadow-md mb-1 ${leaderboard[0].id === user!.id ? 'bg-emerald-500 ring-emerald-300' : 'bg-amber-400'}`}>
                  {(leaderboard[0].display_name ?? leaderboard[0].username).slice(0, 1).toUpperCase()}
                </div>
                <p className="text-sm font-bold text-slate-800 text-center leading-tight truncate w-full max-w-[90px] group-hover:text-emerald-700">
                  {leaderboard[0].display_name ?? leaderboard[0].username}
                  {leaderboard[0].id === user!.id && <span className="text-emerald-600"> (tú)</span>}
                </p>
              </Link>
              <div className="bg-amber-300 rounded-t-2xl w-full h-28 flex flex-col items-center justify-center shadow-sm">
                <span className="text-white font-bold text-3xl leading-none">{leaderboard[0].total}</span>
                <span className="text-white/80 text-xs font-semibold mt-0.5">pts</span>
              </div>
            </div>

            {/* 3º */}
            {leaderboard[2] && (
              <div className="flex flex-col items-center flex-1">
                <span className="text-xl mb-1">🥉</span>
                <Link href={`/clasificacion/${leaderboard[2].id}`} className="flex flex-col items-center group mb-2">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white ring-2 ring-orange-300 mb-1 ${leaderboard[2].id === user!.id ? 'bg-emerald-500 ring-emerald-300' : 'bg-orange-400'}`}>
                    {(leaderboard[2].display_name ?? leaderboard[2].username).slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-slate-700 text-center leading-tight truncate w-full max-w-[80px] group-hover:text-emerald-700">
                    {leaderboard[2].display_name ?? leaderboard[2].username}
                    {leaderboard[2].id === user!.id && <span className="text-emerald-600"> (tú)</span>}
                  </p>
                </Link>
                <div className="bg-orange-300 rounded-t-2xl w-full h-14 flex flex-col items-center justify-center">
                  <span className="text-white font-bold text-xl leading-none">{leaderboard[2].total}</span>
                  <span className="text-white/80 text-xs font-semibold mt-0.5">pts</span>
                </div>
              </div>
            )}

            {/* 4º */}
            {leaderboard[3] && (
              <div className="flex flex-col items-center flex-1">
                <span className="text-xl mb-1">💩</span>
                <Link href={`/clasificacion/${leaderboard[3].id}`} className="flex flex-col items-center group mb-2">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white ring-2 ring-slate-200 mb-1 ${leaderboard[3].id === user!.id ? 'bg-emerald-500 ring-emerald-300' : 'bg-slate-300'}`}>
                    {(leaderboard[3].display_name ?? leaderboard[3].username).slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-slate-600 text-center leading-tight truncate w-full max-w-[80px] group-hover:text-emerald-700">
                    {leaderboard[3].display_name ?? leaderboard[3].username}
                    {leaderboard[3].id === user!.id && <span className="text-emerald-600"> (tú)</span>}
                  </p>
                </Link>
                <div className="bg-slate-200 rounded-t-xl w-full h-10 flex flex-col items-center justify-center">
                  <span className="text-slate-600 font-bold text-base leading-none">{leaderboard[3].total}</span>
                  <span className="text-slate-400 text-[10px] font-semibold mt-0.5">pts</span>
                </div>
              </div>
            )}

          </div>
          {/* Base del podio */}
          <div className="h-2 bg-slate-200 rounded-b-xl" />
        </div>
      )}

      {/* Resto de jugadores (5º en adelante) */}
      {leaderboard.length > 4 && (
        <div className="space-y-2 mb-2">
          {leaderboard.slice(4).map(entry => (
            <div key={entry.id} className={`bg-white rounded-2xl ring-1 px-4 py-3 flex items-center gap-3 ${entry.id === user!.id ? 'ring-emerald-200 bg-emerald-50/60' : 'ring-slate-100'}`}>
              <div className="flex flex-col items-center w-7 shrink-0">
                <span className="font-bold text-slate-400 text-sm leading-tight">{entry.rank}</span>
                {entry.rankChange !== null && entry.rankChange !== 0 && (
                  <span className={`text-[10px] font-bold leading-none ${entry.rankChange > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {entry.rankChange > 0 ? `↑${entry.rankChange}` : `↓${Math.abs(entry.rankChange)}`}
                  </span>
                )}
              </div>
              <Link href={`/clasificacion/${entry.id}`} className="flex-1 min-w-0 hover:text-emerald-700">
                <p className="font-medium text-slate-800 text-sm truncate hover:underline">
                  {entry.display_name ?? entry.username}
                  {entry.id === user!.id && <span className="ml-1 text-xs text-emerald-600 font-normal">(tú)</span>}
                </p>
              </Link>
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
                <span><strong className="text-slate-600">{entry.exact_scores}</strong> exactos</span>
                <span><strong className="text-slate-600">{entry.correct_results}</strong> correctos</span>
              </div>
              <span className="font-bold text-emerald-700 text-sm shrink-0">{entry.total} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Gráfica histórico */}
      {historyData.length > 1 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Evolución del ranking</h2>
          <RankingHistory data={historyData} players={playerNames} myId={user!.id} totalPlayers={leaderboard.length} />
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-4 text-xs text-slate-500 space-y-1.5">
        <p className="font-semibold text-slate-700 mb-2">Sistema de puntuación</p>
        <p><span className="inline-block w-4">🎯</span> Marcador exacto → <strong className="text-amber-700">4 puntos</strong></p>
        <p><span className="inline-block w-4">✅</span> Resultado correcto (1X2) → <strong className="text-emerald-700">1 punto</strong></p>
      </div>
    </div>
  )
}
