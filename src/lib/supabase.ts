import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create client only if we have the required values
let supabase: SupabaseClient

if (supabaseUrl && supabaseKey && supabaseUrl !== 'undefined' && supabaseKey !== 'undefined' && supabaseUrl !== '') {
  supabase = createClient(supabaseUrl, supabaseKey)
} else {
  // Create a placeholder that won't crash the app
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
  // Use a placeholder that will fail gracefully
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key')
}

// Types
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

// Auth functions
export async function signUp(email: string, password: string, name: string, whatsapp: string) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        whatsapp
      }
    }
  })

  if (error) throw error

  // Create staff user record
  if (data.user) {
    const { error: dbError } = await supabase
      .from('staff_users')
      .insert({
        user_id: data.user.id,
        name,
        email,
        phone_number: formatPhone(whatsapp),
        status: 'active'
      })

    if (dbError) console.error('Error creating staff user:', dbError)
  }

  return data
}

export async function signIn(email: string, password: string) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}

// Staff user functions
export async function getStaffUser(userId: string) {
  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data as StaffUser
}

export async function updateStaffUser(userId: string, updates: Partial<StaffUser>) {
  const { error } = await supabase
    .from('staff_users')
    .update(updates)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getStaffHistory(userId: number, limit = 50) {
  const { data, error } = await supabase
    .from('staff_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as StaffHistory[]
}

// Utility functions
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) {
    return `whatsapp:+55${digits}`
  }
  return digits.startsWith('whatsapp:+') ? digits : `whatsapp:+${digits}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export { supabase }