import { supabase } from '@/lib/supabase'

export type StaffWebProfile = {
  user_id: string
  display_name: string | null
  reservation_name: string | null
  reservation_phone: string | null
  web_actions_enabled: boolean
  timezone: string
  locale: string
}

export async function loadStaffWebProfile(userId: string): Promise<StaffWebProfile | null> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('user_id,display_name,reservation_name,reservation_phone,web_actions_enabled,timezone,locale')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as StaffWebProfile | null
}

export async function saveStaffWebProfile(
  userId: string,
  updates: Pick<StaffWebProfile, 'reservation_name' | 'reservation_phone' | 'web_actions_enabled'>,
): Promise<StaffWebProfile> {
  const payload = {
    user_id: userId,
    reservation_name: updates.reservation_name?.trim() || null,
    reservation_phone: updates.reservation_phone?.trim() || null,
    web_actions_enabled: updates.web_actions_enabled,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('staff_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('user_id,display_name,reservation_name,reservation_phone,web_actions_enabled,timezone,locale')
    .single()

  if (error) throw error
  return data as StaffWebProfile
}
