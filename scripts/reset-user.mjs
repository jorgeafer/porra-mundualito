import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Lee .env.local
const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: class {} },
})

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(res => rl.question(q, res))

const TARGET_EMAIL = 'jorge.alvarez.fdz@gmail.com'

async function main() {
  // 1. Buscar usuario por email actual
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('Error:', listErr.message); process.exit(1) }

  const authUser = users.find(u => u.email === TARGET_EMAIL)
  if (!authUser) { console.error(`No se encontró usuario con email ${TARGET_EMAIL}`); process.exit(1) }

  // 2. Obtener username del perfil
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', authUser.id).single()
  if (!profile) { console.error('No se encontró perfil para ese usuario'); process.exit(1) }

  const newEmail = `${profile.username}@porra.local`
  console.log(`\nUsuario encontrado: ${profile.username}`)
  console.log(`Email actual:  ${TARGET_EMAIL}`)
  console.log(`Email nuevo:   ${newEmail}\n`)

  const newPassword = await ask('Nueva contraseña (mínimo 6 caracteres): ')
  rl.close()

  if (newPassword.length < 6) { console.error('Contraseña demasiado corta'); process.exit(1) }

  // 3. Actualizar email + contraseña
  const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
    email: newEmail,
    password: newPassword,
  })

  if (error) { console.error('Error al actualizar:', error.message); process.exit(1) }

  console.log(`\n✓ Contraseña actualizada`)
  console.log(`✓ Email migrado a ${newEmail}`)
  console.log(`\nAhora puedes iniciar sesión con:`)
  console.log(`  Usuario: ${profile.username}`)
  console.log(`  Contraseña: la que acabas de introducir\n`)
}

main()
