import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const supabaseKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

function isValidSupabaseConfiguration(): boolean {
  if (!supabaseUrl || !supabaseKey) return false
  try {
    const url = new URL(supabaseUrl)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

const supabaseConfigured = isValidSupabaseConfiguration()

function runtimeFetch(input: RequestInfo | URL, init?: RequestInit) {
  return globalThis.fetch(input, init)
}

function normalizeAuthError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error || '')

  if (/unable to resolve host|no address associated with hostname|name not resolved|dns/i.test(message)) {
    return new Error('O endereço do servidor do Staff não pôde ser localizado. O aplicativo precisa ser recompilado com o Project URL correto do Supabase.')
  }

  if (/failed to fetch|network request failed|load failed|connection/i.test(message)) {
    return new Error('Não foi possível conectar ao servidor do Staff. Verifique sua internet e tente novamente.')
  }

  return error instanceof Error ? error : new Error(message || 'Não foi possível concluir a autenticação.')
}

let supabase: SupabaseClient

if (supabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: runtimeFetch },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
} else {
  console.error('Supabase não configurado. Defina VITE_SUPABASE_URL e uma chave pública antes do build.')
  supabase = createClient('https://placeholder.invalid', 'placeholder-key')
}

function assertSupabaseConfigured() {
  if (!supabaseConfigured) {
    throw new Error('Servidor do Staff não configurado. Gere novamente o aplicativo com o Project URL e a chave pública corretos do Supabase.')
  }
}

export interface StaffUser {
  id: number
  user_id: string
  name: string
  email: string
  phone_number: string
  assistant_id: string
  thread_id: string | null
  status: 'active' | 'inactive' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface StaffHistory {
  id: number
  user_id: number
  phone_number: string
  thread_id: string
  user_message: string
  bot_reply: string
  created_at: string
}

export async function signUp(email: string, password: string, name: string, whatsapp: string) {
  assertSupabaseConfigured()

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, whatsapp } },
    })

    if (error) throw error

    if (data.user) {
      const { error: dbError } = await supabase.from('staff_users').insert({
        user_id: data.user.id,
        name,
        email,
        phone_number: formatPhone(whatsapp),
        status: 'active',
      })
      if (dbError) console.error('Error creating staff user:', dbError)
    }

    return data
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function signIn(email: string, password: string) {
  assertSupabaseConfigured()

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function signOut() {
  assertSupabaseConfigured()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  if (!supabaseConfigured) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export function onAuthStateChange(callback: (user: any) => void) {
  if (!supabaseConfigured) {
    callback(null)
    return { data: { subscription: { unsubscribe() {} } } }
  }
  return supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null))
}

export async function getStaffUser(userId: string) {
  assertSupabaseConfigured()
  const { data, error } = await supabase.from('staff_users').select('*').eq('user_id', userId).single()
  if (error) throw error
  return data as StaffUser
}

export async function updateStaffUser(userId: string, updates: Partial<StaffUser>) {
  assertSupabaseConfigured()
  const { error } = await supabase.from('staff_users').update(updates).eq('user_id', userId)
  if (error) throw error
}

export async function getStaffHistory(userId: number, limit = 50) {
  assertSupabaseConfigured()
  const { data, error } = await supabase.from('staff_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data as StaffHistory[]
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `whatsapp:+55${digits}`
  return digits.startsWith('whatsapp:+') ? digits : `whatsapp:+${digits}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export { supabase }
