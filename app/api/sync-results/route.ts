import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncResults } from '@/lib/sync-results'

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString()
  // Vercel cron y llamadas automáticas usan Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const calledByCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  console.log(`[sync-results] iniciado caller=${calledByCron ? 'cron' : 'manual'} at=${startedAt}`)

  if (!calledByCron) {
    // Llamada manual: verificar que el usuario es admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
    }
  }

  try {
    const report = await syncResults()
    const elapsed = Date.now() - new Date(startedAt).getTime()
    console.log(`[sync-results] ok updated=${report.updated} points=${report.pointsRecalculated} elapsed=${elapsed}ms`)
    return NextResponse.json({ ok: true, ...report })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[sync-results] error elapsed=${Date.now() - new Date(startedAt).getTime()}ms message=${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
