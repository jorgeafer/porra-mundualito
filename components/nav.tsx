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
    { href: '/partidos', label: 'Partidos' },
    { href: '/clasificacion', label: 'Clasificación' },
    ...(profile?.is_admin ? [{ href: '/admin/resultados', label: 'Admin' }] : []),
  ]

  return (
    <nav className="bg-green-700 text-white shadow-sm">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-base">⚽ Porra</span>
          <div className="flex gap-4">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors hover:text-green-200 ${
                  pathname.startsWith(link.href) ? 'font-semibold underline underline-offset-4' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-200 hidden sm:block">
            {profile?.display_name ?? profile?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs bg-green-800 hover:bg-green-900 px-3 py-1.5 rounded-lg transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
