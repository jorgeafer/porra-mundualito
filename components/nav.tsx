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
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 3C8 6 8 18 12 21"/>
              <path d="M12 3C16 6 16 18 12 21"/>
              <path d="M3.5 9.5Q12 8 20.5 9.5"/>
              <path d="M3.5 14.5Q12 16 20.5 14.5"/>
            </svg>
            <span className="font-bold text-white tracking-tight">Porra Kazoñera</span>
          </div>
          {/* Links — solo en desktop; en móvil se usa el bottom nav */}
          <div className="hidden sm:flex gap-1">
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
