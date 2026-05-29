'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { flagUrlForTeam, translateTeam } from '@/lib/flags'
import type { MatchWithTeams } from '@/types/database'

function formatDate(iso: string) {
  const utc = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  }).format(new Date(utc))
}

function TeamFlag({ name }: { name: string }) {
  const url = flagUrlForTeam(name)
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} className="w-7 h-5 object-cover rounded shadow-sm" />
}

type Pred = { match_id: number; home_score: number | null; away_score: number | null; points: number }
type OtherPred = { user_id: string; home_score: number | null; away_score: number | null }

interface Props {
  match: MatchWithTeams
  prediction: Pred | null
  otherPreds: OtherPred[]
  profileNames: Record<string, string>
  userId: string
  isFirst: boolean
}

const LOCK_BEFORE_MS = 60 * 60 * 1000

export default function HomeMatchCard({ match, prediction: initialPred, otherPreds, profileNames, userId, isFirst }: Props) {
  const [pred, setPred] = useState<Pred | null>(initialPred)
  const [editing, setEditing] = useState(false)
  const [home, setHome] = useState(initialPred?.home_score?.toString() ?? '')
  const [away, setAway] = useState(initialPred?.away_score?.toString() ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const isLocked = match.status !== 'scheduled' ||
    Date.now() >= new Date(match.match_date).getTime() - LOCK_BEFORE_MS
  const hasPred = pred?.home_score != null && pred?.away_score != null

  async function handleSave() {
    if (home === '' || away === '') return
    setSaveState('saving')
    const supabase = createClient()
    const { error } = await supabase.from('predictions').upsert(
      { user_id: userId, match_id: match.id, home_score: Number(home), away_score: Number(away) },
      { onConflict: 'user_id,match_id' }
    )
    if (error) { setSaveState('error'); return }
    setPred({ match_id: match.id, home_score: Number(home), away_score: Number(away), points: pred?.points ?? 0 })
    setSaveState('saved')
    setEditing(false)
    setTimeout(() => setSaveState('idle'), 2000)
  }

  function handleEdit() {
    setHome(pred?.home_score?.toString() ?? '')
    setAway(pred?.away_score?.toString() ?? '')
    setEditing(true)
    setSaveState('idle')
  }

  function handleCancel() {
    setEditing(false)
    setHome(pred?.home_score?.toString() ?? '')
    setAway(pred?.away_score?.toString() ?? '')
    setSaveState('idle')
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 ${isFirst ? 'ring-1 ring-green-200' : 'ring-1 ring-slate-100'}`}>
      {isFirst && <p className="text-xs font-semibold text-green-600 mb-2">Siguiente</p>}

      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamFlag name={match.home_team.name} />
          <p className="text-xs font-semibold text-center truncate w-full leading-tight">
            {translateTeam(match.home_team.name)}
          </p>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center shrink-0 px-1 min-w-[80px]">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={20} value={home}
                onChange={e => { setHome(e.target.value); setSaveState('idle') }}
                className="w-9 h-9 text-center border-2 border-emerald-400 rounded-lg text-base font-bold focus:outline-none focus:border-emerald-500"
                autoFocus
              />
              <span className="text-gray-300 font-bold">–</span>
              <input
                type="number" min={0} max={20} value={away}
                onChange={e => { setAway(e.target.value); setSaveState('idle') }}
                className="w-9 h-9 text-center border-2 border-emerald-400 rounded-lg text-base font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          ) : hasPred ? (
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

        {/* Away */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TeamFlag name={match.away_team.name} />
          <p className="text-xs font-semibold text-center truncate w-full leading-tight">
            {translateTeam(match.away_team.name)}
          </p>
        </div>
      </div>

      {/* Other preds */}
      {otherPreds.length > 0 && !editing && (
        <div className="mt-3 pt-2 border-t border-gray-50 flex flex-wrap gap-x-3 gap-y-1">
          {otherPreds.map(p => (
            <span key={p.user_id} className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{profileNames[p.user_id] ?? '?'}</span>
              {' '}{p.home_score}–{p.away_score}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between ${otherPreds.length > 0 && !editing ? 'mt-2' : 'mt-3 pt-2 border-t border-gray-50'}`}>
        <p className="text-xs text-gray-400 capitalize">{formatDate(match.match_date)}</p>

        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || home === '' || away === ''}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all disabled:opacity-40 ${
                saveState === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {saveState === 'saving' ? '…' : saveState === 'error' ? 'Error' : 'Guardar'}
            </button>
          </div>
        ) : isLocked ? (
          hasPred
            ? <span className="text-xs text-green-600 font-semibold">✓ Pronosticado</span>
            : <span className="text-xs text-gray-300">Cerrado</span>
        ) : hasPred ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 font-semibold">✓ Pronosticado</span>
            <button onClick={handleEdit} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Editar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-700 active:scale-95 transition-all"
          >
            Pronosticar →
          </button>
        )}
      </div>
    </div>
  )
}
