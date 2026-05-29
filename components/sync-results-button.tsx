'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'success' | 'error'

export default function SyncResultsButton() {
  const [state, setState] = useState<State>('idle')
  const [msg, setMsg] = useState('')

  async function handleSync() {
    setState('loading')
    setMsg('')
    try {
      const res = await fetch('/api/sync-results', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      const { updated, pointsRecalculated, errors } = json
      if (updated === 0) {
        setMsg('No hay resultados nuevos que cargar.')
      } else {
        setMsg(
          `${updated} partido${updated !== 1 ? 's' : ''} actualizado${updated !== 1 ? 's' : ''}, ` +
          `${pointsRecalculated} predicciones recalculadas.` +
          (errors?.length ? ` Errores: ${errors.join(', ')}` : '')
        )
      }
      setState('success')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <button
        onClick={handleSync}
        disabled={state === 'loading'}
        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Cargando resultados…' : 'Cargar resultados de partidos jugados'}
      </button>
      {msg && (
        <p className={`text-sm ${state === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {msg}
        </p>
      )}
    </div>
  )
}
