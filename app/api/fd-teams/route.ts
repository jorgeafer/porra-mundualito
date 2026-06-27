import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFinishedMatches } from '@/lib/football-data'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const calledByCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!calledByCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: teams } = await admin.from('teams').select('name')
  const dbNames = new Set((teams ?? []).map(t => t.name.toLowerCase()))

  const matches = await fetchFinishedMatches()

  const fdNames = new Map<string, { name: string | null; shortName: string | null; tla: string | null }>()
  for (const m of matches) {
    if (m.homeTeam.name) fdNames.set(m.homeTeam.name, m.homeTeam)
    if (m.awayTeam.name) fdNames.set(m.awayTeam.name, m.awayTeam)
  }

  const result = [...fdNames.values()].map(t => ({
    fd_name: t.name,
    fd_shortName: t.shortName,
    fd_tla: t.tla,
    found_in_db: (t.name ? dbNames.has(t.name.toLowerCase()) : false)
      || (t.shortName ? dbNames.has(t.shortName.toLowerCase()) : false)
      || (t.tla ? dbNames.has(t.tla.toLowerCase()) : false),
  })).sort((a, b) => Number(a.found_in_db) - Number(b.found_in_db))

  return NextResponse.json({ total: result.length, teams: result })
}
