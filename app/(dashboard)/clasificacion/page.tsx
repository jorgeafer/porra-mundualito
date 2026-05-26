import { createClient } from '@/lib/supabase/server'

type RankedPlayer = {
  id: string
  username: string
  display_name: string | null
  total: number
  correct_results: number
  exact_scores: number
  rank: number
}

export default async function ClasificacionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')

  const { data: predictions } = await supabase
    .from('predictions')
    .select('user_id, points')
    .gt('points', -1)

  const pointsByUser = new Map<string, { total: number; correct: number; exact: number }>()

  for (const p of predictions ?? []) {
    const current = pointsByUser.get(p.user_id) ?? { total: 0, correct: 0, exact: 0 }
    current.total += p.points
    if (p.points > 0) current.correct += 1
    if (p.points === 3) current.exact += 1
    pointsByUser.set(p.user_id, current)
  }

  const leaderboard: RankedPlayer[] = (profiles ?? [])
    .map(p => ({
      ...p,
      total: pointsByUser.get(p.id)?.total ?? 0,
      correct_results: pointsByUser.get(p.id)?.correct ?? 0,
      exact_scores: pointsByUser.get(p.id)?.exact ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.total - a.total || b.exact_scores - a.exact_scores)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clasificación</h1>
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-10">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Jugador</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 hidden sm:table-cell">Exactos</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 hidden sm:table-cell">Acertados</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Puntos</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leaderboard.map(entry => (
              <tr
                key={entry.id}
                className={`hover:bg-gray-50 ${entry.id === user!.id ? 'bg-green-50' : ''}`}
              >
                <td className="px-4 py-3 font-bold text-gray-400">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </td>
                <td className="px-4 py-3 font-medium">
                  {entry.display_name ?? entry.username}
                  {entry.id === user!.id && (
                    <span className="ml-2 text-xs text-green-600 font-normal">(tú)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                  {entry.exact_scores}
                </td>
                <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                  {entry.correct_results}
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-700">{entry.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaderboard.length === 0 && (
          <p className="text-center text-gray-400 py-10">Nadie ha hecho predicciones aún.</p>
        )}
      </div>

      <div className="mt-6 bg-white rounded-2xl border p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 mb-2">Sistema de puntuación</p>
        <p>🎯 Marcador exacto → <strong>3 puntos</strong></p>
        <p>↔️ Diferencia de goles correcta → <strong>2 puntos</strong></p>
        <p>✅ Resultado correcto (1X2) → <strong>1 punto</strong></p>
      </div>
    </div>
  )
}
