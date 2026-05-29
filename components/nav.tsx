'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

export default function Nav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/home', label: 'Inicio' },
    { href: '/partidos', label: 'Partidos' },
    { href: '/clasificacion', label: 'Clasificación' },
    ...(profile?.is_admin ? [{ href: '/admin/resultados', label: 'Admin' }] : []),
  ]

  return (
    <nav className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-sm leading-none">
              ⚽
            </div>
            <span className="font-bold text-white tracking-tight">Porra</span>
          </div>
          <div className="flex gap-1">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:block">
            {profile?.display_name ?? profile?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
