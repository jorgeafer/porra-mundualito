import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllWCMatches, filterKnownMatches, FD_NAME_MAP, normalize } from '@/lib/football-data'
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

  const allMatches = await fetchAllWCMatches()
  const knownMatches = filterKnownMatches(allMatches)

  const fdNames = new Map<string, { name: string; shortName: string; tla: string }>()
  for (const m of knownMatches) {
    fdNames.set(m.homeTeam.name, m.homeTeam)
    fdNames.set(m.awayTeam.name, m.awayTeam)
  }

  // Also show how many TBD matches were skipped
  const tbdCount = allMatches.length - knownMatches.length

  const result = [...fdNames.values()].map(t => {
    const mapped = FD_NAME_MAP[normalize(t.name)]
    const resolvedName = mapped ?? normalize(t.name)
    return {
      fd_name: t.name,
      fd_shortName: t.shortName,
      fd_tla: t.tla,
      mapped_to: mapped ?? null,
      found_in_db: dbNames.has(resolvedName)
        || dbNames.has(normalize(t.shortName))
        || dbNames.has(normalize(t.tla)),
    }
  }).sort((a, b) => Number(a.found_in_db) - Number(b.found_in_db))

  return NextResponse.json({
    total_matches: allMatches.length,
    known_matches: knownMatches.length,
    tbd_skipped: tbdCount,
    total_teams: result.length,
    teams: result,
  })
}
