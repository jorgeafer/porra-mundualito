import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  async function login(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const username = (formData.get('username') as string).trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@porra.local`,
      password: formData.get('password') as string,
    })
    if (error) redirect('/login?error=' + encodeURIComponent(error.message))
    redirect('/partidos')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-emerald-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 text-3xl mb-4 shadow-lg">
            ⚽
          </div>
          <h1 className="text-2xl font-bold text-white">Porra Mundialito</h1>
          <p className="text-slate-400 text-sm mt-1">Mundial 2026</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7">
          {error && (
            <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={login} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Usuario</label>
              <input
                name="username"
                type="text"
                required
                autoComplete="username"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 font-semibold text-sm transition mt-2"
            >
              Entrar
            </button>
          </form>

          <p className="text-center text-sm mt-5 text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-emerald-600 hover:underline font-medium">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
