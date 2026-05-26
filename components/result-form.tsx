'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MatchWithTeams } from '@/types/database'

export default function ResultForm({ match }: { match: MatchWithTeams }) {
  const [home, setHome] = useState<string | number>(match.home_score ?? '')
  const [away, setAway] = useState<string | number>(match.away_score ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (home === '' || away === '') return
    setState('saving')

    const supabase = createClient()
    const { error } = await supabase
      .from('matches')
      .update({ home_score: Number(home), away_score: Number(away), status: 'finished' })
      .eq('id', match.id)

    if (error) { setState('error'); return }

    // Recalculate points for all predictions on this match
    await fetch('/api/recalculate-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: match.id, home_score: Number(home), away_score: Number(away) }),
    })

    setState('saved')
    setTimeout(() => setState('idle'), 2000)
  }

  const isFinished = match.status === 'finished'

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center gap-3 bg-white rounded-xl border p-3 ${isFinished ? 'border-green-200' : ''}`}
    >
      <div className="flex-1 text-sm font-medium truncate">
        {match.home_team.flag_emoji} {match.home_team.name}
        <span className="text-gray-400 mx-1">vs</span>
        {match.away_team.name} {match.away_team.flag_emoji}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number" min={0} max={20} value={home}
          onChange={e => setHome(e.target.value)}
          className="w-10 h-9 text-center border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400">-</span>
        <input
          type="number" min={0} max={20} value={away}
          onChange={e => setAway(e.target.value)}
          className="w-10 h-9 text-center border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={state === 'saving' || home === '' || away === ''}
        className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0"
      >
        {state === 'saving' ? '...' : state === 'saved' ? '✓' : state === 'error' ? 'Error' : 'Guardar'}
      </button>
    </form>
  )
}
