'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'success' | 'error'

export default function ImportButton() {
  const [state, setState] = useState<State>('idle')
  const [msg, setMsg] = useState('')

  async function handleImport() {
    setState('loading')
    setMsg('')
    try {
      const res = await fetch('/api/import-wc', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      setMsg(`Importados ${json.teams} equipos y ${json.matches} partidos.`)
      setState('success')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleImport}
        disabled={state === 'loading'}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Importando…' : 'Importar desde WC2026 API'}
      </button>
      {msg && (
        <p className={`text-sm ${state === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {msg}
        </p>
      )}
    </div>
  )
}
