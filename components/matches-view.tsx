'use client'

import { useState } from 'react'
import PredictionCard from './prediction-card'
import type { MatchWithTeams, Prediction } from '@/types/database'

const STAGES = [
  { key: 'group', label: 'Grupos' },
  { key: 'round_of_32', label: 'Ronda 32' },
  { key: 'round_of_16', label: 'Octavos' },
  { key: 'quarter', label: 'Cuartos' },
  { key: 'semi', label: 'Semis' },
  { key: 'third_place', label: '3.º/4.º' },
  { key: 'final', label: 'Final' },
]

interface Props {
  matches: MatchWithTeams[]
  predictions: Record<number, Prediction>
  userId: string
}

export default function MatchesView({ matches, predictions, userId }: Props) {
  const availableStages = STAGES.filter(s => matches.some(m => m.stage === s.key))
  const [activeStage, setActiveStage] = useState(availableStages[0]?.key ?? 'group')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const stageMatches = matches.filter(m => m.stage === activeStage)

  const groups = activeStage === 'group'
    ? [...new Set(stageMatches.map(m => m.group_name).filter(Boolean) as string[])].sort()
    : []

  const currentGroup = activeGroup ?? groups[0] ?? null

  const displayed = currentGroup
    ? stageMatches.filter(m => m.group_name === currentGroup)
    : stageMatches

  const scheduledCount = matches.filter(m => m.status === 'scheduled').length
  const predictedCount = matches.filter(m => m.status === 'scheduled' && predictions[m.id]).length

  function handleStageChange(key: string) {
    setActiveStage(key)
    setActiveGroup(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Partidos</h1>
        {scheduledCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 text-right">
              <span className="font-semibold text-gray-800">{predictedCount}</span>
              <span>/{scheduledCount}</span>
            </div>
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(predictedCount / scheduledCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stage tabs */}
      {availableStages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          {availableStages.map(s => (
            <button
              key={s.key}
              onClick={() => handleStageChange(s.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeStage === s.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Group sub-tabs */}
      {groups.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors flex-shrink-0 ${
                currentGroup === g
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Matches */}
      {displayed.length > 0 ? (
        <div className="space-y-3">
          {displayed.map(match => (
            <PredictionCard
              key={match.id}
              match={match}
              prediction={predictions[match.id] ?? null}
              userId={userId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400 text-sm">
          No hay partidos en esta fase todavía.
        </div>
      )}
    </div>
  )
}
