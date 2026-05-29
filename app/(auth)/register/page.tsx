import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: Props) {
  const { error } = await searchParams

  async function register(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const password = formData.get('password') as string
    const username = (formData.get('username') as string).trim().toLowerCase()
    const displayName = (formData.get('display_name') as string).trim() || username
    const email = `${username}@porra.local`

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName } },
    })
    if (signUpError) {
      redirect('/register?error=' + encodeURIComponent(signUpError.message))
    }

    redirect('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-emerald-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoPorra.png" alt="Logo" className="w-16 h-16 rounded-2xl object-cover shadow-xl mb-4" />
          <h1 className="text-2xl font-bold text-white">Porra Kazoñera</h1>
          <p className="text-slate-400 text-sm mt-1">Mundial 2026 · Crea tu cuenta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7">
          {error && (
            <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={register} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre para mostrar</label>
              <input
                name="display_name"
                type="text"
                required
                placeholder="Ej: Jorge"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de usuario</label>
              <input
                name="username"
                type="text"
                required
                placeholder="Ej: jorge123"
                pattern="[a-zA-Z0-9_]{3,20}"
                title="Solo letras, números y guiones bajos (3-20 caracteres)"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 font-semibold text-sm transition mt-2"
            >
              Crear cuenta
            </button>
          </form>

          <p className="text-center text-sm mt-5 text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-emerald-600 hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
