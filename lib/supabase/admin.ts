import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Server-only client that bypasses RLS — never import this in client components
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local')
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
