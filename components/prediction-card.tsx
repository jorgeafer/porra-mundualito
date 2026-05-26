'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MatchWithTeams, Prediction } from '@/types/database'

interface Props {
  match: MatchWithTeams
  prediction: Prediction | null
  userId: string
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: '',
  live: 'En directo',
  finished: 'Finalizado',
}

export default function PredictionCard({ match, prediction, userId }: Props) {
  const [home, setHome] = useState<string | number>(prediction?.home_score ?? '')
  const [away, setAway] = useState<string | number>(prediction?.away_score ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const isLocked = match.status !== 'scheduled'

  async function handleSave() {
    if (home === '' || away === '') return
    setState('saving')
    const supabase = createClient()
    const { error } = await supabase.from('predictions').upsert(
      { user_id: userId, match_id: match.id, home_score: Number(home), away_score: Number(away) },
      { onConflict: 'user_id,match_id' }
    )
    setState(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setState('idle'), 2000)
  }

  const pointsColor =
    prediction?.points === 3 ? 'text-yellow-600' :
    prediction?.points === 2 ? 'text-blue-600' :
    prediction?.points === 1 ? 'text-green-600' : 'text-gray-400'

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl leading-none">{match.home_team.flag_emoji ?? '🏳️'}</span>
          <span className="font-medium text-sm truncate">{match.home_team.name}</span>
        </div>

        {/* Score area */}
        <div className="flex items-center gap-2 shrink-0">
          {match.status === 'finished' ? (
            <>
              <span className="w-9 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-lg font-bold">
                {match.home_score}
              </span>
              <span className="text-gray-400 font-bold">-</span>
              <span className="w-9 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-lg font-bold">
                {match.away_score}
              </span>
            </>
          ) : (
            <>
              <input
                type="number" min={0} max={20} value={home}
                onChange={e => { setHome(e.target.value); setState('idle') }}
                disabled={isLocked}
                className="w-9 h-10 text-center border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="text-gray-400 font-bold">-</span>
              <input
                type="number" min={0} max={20} value={away}
                onChange={e => { setAway(e.target.value); setState('idle') }}
                disabled={isLocked}
                className="w-9 h-10 text-center border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-medium text-sm truncate">{match.away_team.name}</span>
          <span className="text-xl leading-none">{match.away_team.flag_emoji ?? '🏳️'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span>{formatDate(match.match_date)}</span>
          {match.group_name && <span>· Grupo {match.group_name}</span>}
          {STATUS_BADGE[match.status] && (
            <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
              {STATUS_BADGE[match.status]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {prediction && match.status === 'finished' && (
            <span className={`font-bold ${pointsColor}`}>
              +{prediction.points} pts
            </span>
          )}
          {!isLocked && (
            <button
              onClick={handleSave}
              disabled={state === 'saving' || home === '' || away === ''}
              className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              {state === 'saving' ? '...' : state === 'saved' ? '✓ Guardado' : state === 'error' ? 'Error' : 'Guardar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
