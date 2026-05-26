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
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const username = (formData.get('username') as string).trim().toLowerCase()

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      redirect('/register?error=' + encodeURIComponent(signUpError?.message ?? 'Error al registrarse'))
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user!.id,
      username,
      display_name: formData.get('display_name') as string || username,
    })
    if (profileError) {
      redirect('/register?error=' + encodeURIComponent(profileError.message))
    }

    redirect('/partidos')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">Crear cuenta</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Únete a la porra</p>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {decodeURIComponent(error)}
          </p>
        )}

        <form action={register} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre para mostrar</label>
            <input
              name="display_name"
              type="text"
              required
              placeholder="Ej: Jorge"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de usuario</label>
            <input
              name="username"
              type="text"
              required
              placeholder="Ej: jorge123"
              pattern="[a-zA-Z0-9_]{3,20}"
              title="Solo letras, números y guiones bajos (3-20 caracteres)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            Registrarse
          </button>
        </form>

        <p className="text-center text-sm mt-4 text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-green-600 hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
