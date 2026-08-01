import { createClient } from '@supabase/supabase-js'

export default async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const backendSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !backendSecret) {
    console.error('automation-runner: SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
    return new Response(null, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, backendSecret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data, error } = await supabase.rpc('staff_process_due_automations', {
    p_now: new Date().toISOString(),
  })

  if (error) {
    console.error('automation-runner:', error)
    return new Response(null, { status: 500 })
  }

  console.log('automation-runner:', JSON.stringify(data))
  return new Response(null, { status: 204 })
}

export const config = {
  schedule: '*/5 * * * *',
}
