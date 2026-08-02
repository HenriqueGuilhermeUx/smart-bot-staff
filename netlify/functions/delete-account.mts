import { createClient } from '@supabase/supabase-js'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || Boolean(error.message?.toLowerCase().includes('could not find the table'))
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const backendSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !backendSecret) return json({ error: 'Serviço de exclusão não configurado.' }, 500)

  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return json({ error: 'Sessão obrigatória.' }, 401)

  const admin = createClient(supabaseUrl, backendSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)
  const userId = userData.user.id

  const { data: staffUser } = await admin
    .from('staff_users')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (staffUser?.id) {
    const { error } = await admin.from('staff_history').delete().eq('user_id', staffUser.id)
    if (error && !isMissingRelation(error)) console.error('delete-account staff_history:', error)
  }

  const tables = [
    'staff_event_reminders',
    'staff_event_recurrences',
    'staff_automation_runs',
    'staff_action_queue',
    'staff_notifications',
    'staff_events',
    'staff_automations',
    'staff_messages',
    'staff_memories',
    'staff_tasks',
    'staff_notification_preferences',
    'staff_profiles',
    'staff_users',
  ]

  const cleanupErrors: string[] = []
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error && !isMissingRelation(error)) {
      console.error(`delete-account ${table}:`, error)
      cleanupErrors.push(table)
    }
  }

  if (cleanupErrors.length > 0) {
    return json({ error: 'Não foi possível concluir a limpeza dos dados.', tables: cleanupErrors }, 500)
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserError) {
    console.error('delete-account auth user:', deleteUserError)
    return json({ error: 'Não foi possível excluir a conta de autenticação.' }, 500)
  }

  return json({ deleted: true })
}
