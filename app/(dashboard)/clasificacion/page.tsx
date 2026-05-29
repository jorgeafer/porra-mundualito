import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase.from('profiles').select('id, username, display_name')

  // Fetch predictions joined with match stage
  const { data: predictions } = await supabase
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
    if (p.points === 3) cur.exact++
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

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-400 w-8">#</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Jugador</th>
              {activeStages.map(s => (
                <th key={s} className="px-3 py-3 text-center font-medium text-slate-400 text-xs">{STAGE_LABELS[s]}</th>
              ))}
              <th className="px-4 py-3 text-center font-medium text-slate-500 hidden sm:table-cell">Exactos</th>
              <th className="px-4 py-3 text-center font-medium text-slate-500 hidden sm:table-cell">Acertados</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {leaderboard.map(entry => (
              <tr key={entry.id} className={`hover:bg-slate-50 transition-colors ${entry.id === user!.id ? 'bg-emerald-50/60' : ''}`}>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="font-bold text-slate-400">
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                    </span>
                    {entry.rankChange !== null && entry.rankChange !== 0 && (
                      <span className={`text-xs font-semibold ${entry.rankChange > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {entry.rankChange > 0 ? `↑${entry.rankChange}` : `↓${Math.abs(entry.rankChange)}`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  <Link href={`/clasificacion/${entry.id}`} className="hover:text-emerald-700 hover:underline">
                    {entry.display_name ?? entry.username}
                  </Link>
                  {entry.id === user!.id && <span className="ml-1.5 text-xs text-emerald-600 font-normal">(tú)</span>}
                </td>
                {activeStages.map(s => (
                  <td key={s} className="px-3 py-3 text-center text-xs">
                    {entry.byStage[s]
                      ? <span className="font-bold text-emerald-700">{entry.byStage[s]}</span>
                      : <span className="text-slate-200">–</span>}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-slate-500 hidden sm:table-cell">{entry.exact_scores}</td>
                <td className="px-4 py-3 text-center text-slate-500 hidden sm:table-cell">{entry.correct_results}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{entry.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaderboard.length === 0 && (
          <p className="text-center text-slate-400 py-10">Nadie ha hecho predicciones aún.</p>
        )}
      </div>

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
        <p><span className="inline-block w-4">🎯</span> Marcador exacto → <strong className="text-amber-700">3 puntos</strong></p>
        <p><span className="inline-block w-4">↔️</span> Diferencia de goles correcta → <strong className="text-sky-700">2 puntos</strong></p>
        <p><span className="inline-block w-4">✅</span> Resultado correcto (1X2) → <strong className="text-emerald-700">1 punto</strong></p>
      </div>
    </div>
  )
}
