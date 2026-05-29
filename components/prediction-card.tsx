'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { flagUrlForTeam, translateTeam } from '@/lib/flags'
import type { MatchWithTeams, Prediction } from '@/types/database'

interface Props {
  match: MatchWithTeams
  prediction: Prediction | null
  userId: string
}

function formatDate(iso: string) {
  const utc = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  }).format(new Date(utc))
}

function TeamBadge({ code, name }: { code: string; name: string }) {
  const url = flagUrlForTeam(name)
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} className="w-12 h-8 object-cover rounded-lg shadow-sm" />
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 tracking-wide">
      {code}
    </span>
  )
}

const POINTS_LABEL: Record<number, { label: string; cls: string }> = {
  3: { label: '+3 pts', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  2: { label: '+2 pts', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  1: { label: '+1 pt',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

export default function PredictionCard({ match, prediction, userId }: Props) {
  const [home, setHome] = useState<string>(prediction?.home_score?.toString() ?? '')
  const [away, setAway] = useState<string>(prediction?.away_score?.toString() ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const LOCK_BEFORE_MS = 60 * 60 * 1000
  const isLocked = match.status !== 'scheduled' || now >= new Date(match.match_date).getTime() - LOCK_BEFORE_MS
  const hasPrediction = home !== '' && away !== ''
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const points = prediction?.points

  async function handleSave() {
    if (!hasPrediction) return
    setState('saving')
    const supabase = createClient()
    const { error } = await supabase.from('predictions').upsert(
      { user_id: userId, match_id: match.id, home_score: Number(home), away_score: Number(away) },
      { onConflict: 'user_id,match_id' }
    )
    setState(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setState('idle'), 2000)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${
      isLive ? 'ring-2 ring-red-400' : 'ring-1 ring-slate-100'
    }`}>
      {/* Live banner */}
      {isLive && (
        <div className="bg-red-500 text-white text-xs font-bold text-center py-1.5 tracking-widest uppercase">
          En directo
        </div>
      )}

      <div className="p-4">
        {/* Teams + score row */}
        <div className="flex items-center gap-3">
          {/* Home */}
          <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <TeamBadge code={match.home_team.code} name={match.home_team.name} />
            <span className="text-xs font-semibold text-slate-700 text-center leading-tight truncate w-full text-center">
              {translateTeam(match.home_team.name)}
            </span>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {isFinished ? (
              <div className="flex items-center gap-1.5">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl text-lg font-bold">
                  {match.home_score}
                </span>
                <span className="text-slate-300 font-bold">–</span>
                <span className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-xl text-lg font-bold">
                  {match.away_score}
                </span>
              </div>
            ) : isLocked ? (
              <span className="text-xs text-slate-300 font-bold tracking-widest px-3">VS</span>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={20} value={home}
                  onChange={e => { setHome(e.target.value); setState('idle') }}
                  className="w-10 h-10 text-center border-2 border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-slate-300 font-bold">–</span>
                <input
                  type="number" min={0} max={20} value={away}
                  onChange={e => { setAway(e.target.value); setState('idle') }}
                  className="w-10 h-10 text-center border-2 border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
            {match.group_name && (
              <span className="text-xs text-slate-300">Gr. {match.group_name}</span>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <TeamBadge code={match.away_team.code} name={match.away_team.name} />
            <span className="text-xs font-semibold text-slate-700 text-center leading-tight truncate w-full text-center">
              {translateTeam(match.away_team.name)}
            </span>
          </div>
        </div>

        {/* My prediction result (when finished) */}
        {isFinished && prediction && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-400">Tu pronóstico:</span>
            <span className="text-xs font-semibold text-slate-600">
              {prediction.home_score} – {prediction.away_score}
            </span>
            {points !== undefined && points !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                POINTS_LABEL[points]?.cls ?? 'bg-slate-100 text-slate-400 border-slate-200'
              }`}>
                {POINTS_LABEL[points]?.label ?? '0 pts'}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
          <div className="text-xs text-slate-400">
            <p>{formatDate(match.match_date)}</p>
            {match.venue && <p className="text-slate-300 mt-0.5">{match.venue}</p>}
          </div>

          {!isLocked && (
            <button
              onClick={handleSave}
              disabled={state === 'saving' || !hasPrediction}
              className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all disabled:opacity-40 ${
                state === 'saved'
                  ? 'bg-emerald-100 text-emerald-700'
                  : state === 'error'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {state === 'saving' ? '…' : state === 'saved' ? '✓ Guardado' : state === 'error' ? 'Error' : 'Guardar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
