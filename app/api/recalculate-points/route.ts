import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePoints } from '@/lib/scoring'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { match_id, home_score, away_score } = await request.json()

  // Usar admin client para leer y actualizar predicciones de todos los usuarios (bypass RLS)
  const admin = createAdminClient()
  const { data: predictions } = await admin
    .from('predictions')
    .select('*')
    .eq('match_id', match_id)

  if (!predictions?.length) return NextResponse.json({ ok: true, updated: 0 })

  const updates = predictions.map(p => ({
    id: p.id,
    points: calculatePoints(
      { home: p.home_score, away: p.away_score },
      { home: home_score, away: away_score }
    ),
  }))

  for (const { id, points } of updates) {
    await admin.from('predictions').update({ points }).eq('id', id)
  }

  return NextResponse.json({ ok: true, updated: updates.length })
}
