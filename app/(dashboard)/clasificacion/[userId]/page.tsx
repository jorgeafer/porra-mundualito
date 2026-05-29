import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flagUrlForTeam, translateTeam } from '@/lib/flags'

const STAGE_LABELS: Record<string, string> = {
  group: 'Grupos', round_of_32: 'R32', round_of_16: 'Octavos',
  quarter: 'Cuartos', semi: 'Semis', third_place: '3º/4º', final: 'Final',
}

const POINTS_STYLE: Record<number, string> = {
  3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  2: 'bg-blue-100 text-blue-700 border-blue-200',
  1: 'bg-green-100 text-green-700 border-green-200',
}

function formatDate(iso: string) {
  const utc = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  }).format(new Date(utc))
}

function Flag({ name }: { name: string }) {
  const url = flagUrlForTeam(name)
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} className="w-7 h-5 object-cover rounded shadow-sm shrink-0" />
}

type PredWithMatch = {
  id: number
  home_score: number
  away_score: number
  points: number
  match: {
    id: number
    match_date: string
    stage: string
    group_name: string | null
    home_score: number | null
    away_score: number | null
    status: string
    home_team: { name: string; code: string }
    away_team: { name: string; code: string }
  } | null
}

function computeStreaks(preds: PredWithMatch[]) {
  const finished = preds
    .filter(p => p.match?.status === 'finished')
    .sort((a, b) => new Date(a.match!.match_date).getTime() - new Date(b.match!.match_date).getTime())

  let best = 0, run = 0
  for (const p of finished) {
    if (p.points > 0) { run++; best = Math.max(best, run) } else { run = 0 }
  }

  let current = 0
  for (let i = finished.length - 1; i >= 0; i--) {
    if (finished[i].points > 0) current++
    else break
  }

  return { best, current }
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: rawPreds },
    { data: allPredictions },
    { data: allProfiles },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.from('predictions').select(`
      id, home_score, away_score, points,
      match:matches!match_id(
        id, match_date, stage, group_name, home_score, away_score, status,
        home_team:teams!home_team_id(name, code),
        away_team:teams!away_team_id(name, code)
      )
    `).eq('user_id', userId),
    admin.from('predictions').select('user_id, points'),
    admin.from('profiles').select('id'),
  ])

  if (!profile) notFound()

  const preds = (rawPreds ?? []) as unknown as PredWithMatch[]
  const finished = preds
    .filter(p => p.match?.status === 'finished')
    .sort((a, b) => new Date(b.match!.match_date).getTime() - new Date(a.match!.match_date).getTime())

  const upcoming = preds
    .filter(p => p.match?.status !== 'finished')
    .sort((a, b) => new Date(a.match!.match_date).getTime() - new Date(b.match!.match_date).getTime())

  const total = finished.reduce((s, p) => s + p.points, 0)
  const exact = finished.filter(p => p.points === 3).length
  const correct = finished.filter(p => p.points > 0).length
  const { best: bestStreak, current: currentStreak } = computeStreaks(preds)

  // Rank
  const allPreds = (allPredictions ?? []) as { user_id: string; points: number }[]
  const pointsByUser: Record<string, number> = {}
  for (const p of allPreds) {
    pointsByUser[p.user_id] = (pointsByUser[p.user_id] ?? 0) + p.points
  }
  const sortedPlayers = Object.entries(pointsByUser).sort((a, b) => b[1] - a[1])
  const rank = sortedPlayers.findIndex(([id]) => id === userId) + 1
  const totalPlayers = (allProfiles ?? []).length

  const isMe = userId === user.id

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/clasificacion" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        ← Clasificación
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
        {isMe && <p className="text-sm text-green-600 mt-0.5">Tu perfil</p>}
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{total}</p>
          <p className="text-xs text-gray-500 mt-1">Puntos</p>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{rank > 0 ? `${rank}º` : '–'}</p>
          <p className="text-xs text-gray-500 mt-1">de {totalPlayers}</p>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{exact}</p>
          <p className="text-xs text-gray-500 mt-1">Exactos</p>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{correct}</p>
          <p className="text-xs text-gray-500 mt-1">Acertados</p>
        </div>
      </div>

      {/* Rachas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{currentStreak}</p>
          <p className="text-xs text-gray-500 mt-1">Racha actual</p>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{bestStreak}</p>
          <p className="text-xs text-gray-500 mt-1">Mejor racha</p>
        </div>
      </div>

      {/* Próximos pronósticos */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Próximos pronósticos · {upcoming.length}
          </p>
          <div className="space-y-2">
            {upcoming.map(pred => {
              const m = pred.match!
              return (
                <div key={pred.id} className="bg-white rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-10 shrink-0 text-center">
                      {STAGE_LABELS[m.stage] ?? m.stage}
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className="text-xs font-medium truncate">{translateTeam(m.home_team.name)}</span>
                      <Flag name={m.home_team.name} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="w-6 h-6 flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-bold">
                        {pred.home_score}
                      </span>
                      <span className="text-gray-300 text-xs">–</span>
                      <span className="w-6 h-6 flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-bold">
                        {pred.away_score}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Flag name={m.away_team.name} />
                      <span className="text-xs font-medium truncate">{translateTeam(m.away_team.name)}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap hidden sm:block">
                      {formatDate(m.match_date)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historial de pronósticos */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Historial · {finished.length} partidos
        </p>

        {finished.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">Sin partidos jugados aún.</p>
        ) : (
          <div className="space-y-2">
            {finished.map(pred => {
              const m = pred.match!
              const pts = pred.points
              return (
                <div key={pred.id} className="bg-white rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    {/* Stage */}
                    <span className="text-xs text-gray-300 w-10 shrink-0 text-center">
                      {STAGE_LABELS[m.stage] ?? m.stage}
                    </span>

                    {/* Home */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className="text-xs font-medium truncate">{translateTeam(m.home_team.name)}</span>
                      <Flag name={m.home_team.name} />
                    </div>

                    {/* Resultado real */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-900 text-white rounded text-xs font-bold">
                        {m.home_score}
                      </span>
                      <span className="text-gray-300 text-xs">–</span>
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-900 text-white rounded text-xs font-bold">
                        {m.away_score}
                      </span>
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Flag name={m.away_team.name} />
                      <span className="text-xs font-medium truncate">{translateTeam(m.away_team.name)}</span>
                    </div>

                    {/* Puntos */}
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border shrink-0 ${
                      POINTS_STYLE[pts] ?? 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}>
                      {pts > 0 ? `+${pts}` : '0'}
                    </span>
                  </div>

                  {/* Pronóstico */}
                  <div className="flex items-center gap-1 mt-1.5 pl-12">
                    <span className="text-xs text-gray-400">Pronóstico:</span>
                    <span className="text-xs font-semibold text-gray-600">
                      {pred.home_score} – {pred.away_score}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
