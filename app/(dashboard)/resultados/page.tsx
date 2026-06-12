import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { flagUrlForTeam, translateTeam } from '@/lib/flags'

const STAGE_LABELS: Record<string, string> = {
  group: 'Grupos', round_of_32: 'R32', round_of_16: 'Octavos',
  quarter: 'Cuartos', semi: 'Semis', third_place: '3º/4º', final: 'Final',
}

const POINTS_STYLE: Record<number, string> = {
  3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  1: 'bg-green-100 text-green-700 border-green-200',
}

function formatDate(iso: string) {
  const utc = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  }).format(new Date(utc))
}

function Flag({ name }: { name: string }) {
  const url = flagUrlForTeam(name)
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} className="w-7 h-5 object-cover rounded shadow-sm shrink-0" />
}

type MatchRow = {
  id: number
  match_date: string
  stage: string
  group_name: string | null
  home_score: number | null
  away_score: number | null
  home_team: { name: string }
  away_team: { name: string }
}

type PredRow = {
  user_id: string
  match_id: number
  home_score: number | null
  away_score: number | null
  points: number
}

export default async function ResultadosPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: matches },
    { data: allPredictions },
    { data: profiles },
  ] = await Promise.all([
    admin
      .from('matches')
      .select('id, match_date, stage, group_name, home_score, away_score, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('status', 'finished')
      .order('match_date', { ascending: false }),
    admin.from('predictions').select('user_id, match_id, home_score, away_score, points'),
    supabase.from('profiles').select('id, username, display_name'),
  ])

  const finishedMatches = (matches ?? []) as unknown as MatchRow[]
  const preds = (allPredictions ?? []) as PredRow[]

  const profileNames: Record<string, string> = {}
  for (const p of profiles ?? []) profileNames[p.id] = p.display_name ?? p.username

  const predsByMatch = new Map<number, PredRow[]>()
  for (const p of preds) {
    if (p.home_score == null || p.away_score == null) continue
    const arr = predsByMatch.get(p.match_id) ?? []
    arr.push(p)
    predsByMatch.set(p.match_id, arr)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Resultados</h1>

      {finishedMatches.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">Aún no hay partidos jugados.</p>
      )}

      {finishedMatches.map(match => {
        const matchPreds = (predsByMatch.get(match.id) ?? [])
          .sort((a, b) => b.points - a.points)

        return (
          <div key={match.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
            {/* Match header */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {STAGE_LABELS[match.stage] ?? match.stage}
                  {match.group_name ? ` · Gr. ${match.group_name}` : ''}
                </span>
                <span className="text-[10px] text-gray-400 capitalize">{formatDate(match.match_date)}</span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                {/* Home */}
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <Flag name={match.home_team.name} />
                  <p className="text-xs font-semibold text-center truncate w-full leading-tight">
                    {translateTeam(match.home_team.name)}
                  </p>
                </div>

                {/* Score */}
                <div className="flex items-center gap-1.5 shrink-0 px-1">
                  <span className="w-9 h-9 flex items-center justify-center bg-slate-800 text-white rounded-lg text-base font-bold">
                    {match.home_score ?? '–'}
                  </span>
                  <span className="text-gray-300 font-bold">–</span>
                  <span className="w-9 h-9 flex items-center justify-center bg-slate-800 text-white rounded-lg text-base font-bold">
                    {match.away_score ?? '–'}
                  </span>
                </div>

                {/* Away */}
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <Flag name={match.away_team.name} />
                  <p className="text-xs font-semibold text-center truncate w-full leading-tight">
                    {translateTeam(match.away_team.name)}
                  </p>
                </div>
              </div>
            </div>

            {/* Predictions list */}
            {matchPreds.length > 0 ? (
              <div className="border-t border-gray-50">
                {matchPreds.map((p, i) => {
                  const isMe = p.user_id === user.id
                  const ptStyle = POINTS_STYLE[p.points] ?? 'bg-gray-100 text-gray-500 border-gray-200'
                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} ${isMe ? 'ring-inset ring-1 ring-emerald-200' : ''}`}
                    >
                      <span className={`font-semibold truncate flex-1 ${isMe ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {isMe ? 'Tú' : (profileNames[p.user_id] ?? '?')}
                      </span>
                      <span className="text-gray-500 tabular-nums font-medium shrink-0">
                        {p.home_score}–{p.away_score}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${ptStyle}`}>
                        +{p.points}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="border-t border-gray-50 px-4 py-3">
                <p className="text-xs text-gray-400">Nadie pronosticó este partido.</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
