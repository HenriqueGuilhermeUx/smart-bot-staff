declare const Netlify: { env: { get(name: string): string | undefined } }

export type CapabilityActionRow = {
  id: string
  user_id: string | null
  source_app: string
  external_subject_id: string | null
  capability: string | null
  request_text: string
  intent: 'restaurant_reservation' | 'web_lookup' | 'appointment_search'
  risk_level: 'read_only' | 'low' | 'blocked'
  status: 'queued' | 'running' | 'needs_profile' | 'needs_confirmation' | 'completed' | 'failed' | 'cancelled'
  provider: string
  external_task_id: string | null
  external_session_id: string | null
  result_summary: string | null
  result_json: Record<string, unknown>
  error_message: string | null
  created_at?: string
  updated_at?: string
}

export function env(name: string) {
  try {
    return String(Netlify.env.get(name) || '').trim()
  } catch {
    return String(process.env[name] || '').trim()
  }
}

export function staffStoreConfig() {
  const supabaseUrl = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !serviceKey) throw new Error('STAFF_STORE_NOT_CONFIGURED')
  return { supabaseUrl, serviceKey }
}

function serviceHeaders(serviceKey: string, extra: HeadersInit = {}) {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    'content-type': 'application/json',
  }
  if (!serviceKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${serviceKey}`
  return { ...headers, ...(extra as Record<string, string>) }
}

export async function insertFederatedAction(input: {
  sourceApp: string
  subjectId: string
  capability: string
  requestText: string
  intent: CapabilityActionRow['intent']
  riskLevel?: CapabilityActionRow['risk_level']
  status?: CapabilityActionRow['status']
  resultJson?: Record<string, unknown>
}) {
  const { supabaseUrl, serviceKey } = staffStoreConfig()
  const response = await fetch(`${supabaseUrl}/rest/v1/staff_web_actions`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      user_id: null,
      source_app: input.sourceApp,
      external_subject_id: input.subjectId.slice(0, 200),
      capability: input.capability.slice(0, 120),
      request_text: input.requestText.slice(0, 4000),
      intent: input.intent,
      risk_level: input.riskLevel || 'low',
      status: input.status || 'queued',
      result_json: input.resultJson || {},
    }),
  })
  if (!response.ok) throw new Error(`STAFF_STORE_INSERT_${response.status}`)
  const rows = await response.json()
  return rows[0] as CapabilityActionRow
}

export async function getFederatedAction(sourceApp: string, subjectId: string, actionId: string) {
  const { supabaseUrl, serviceKey } = staffStoreConfig()
  const params = new URLSearchParams({
    id: `eq.${actionId}`,
    source_app: `eq.${sourceApp}`,
    external_subject_id: `eq.${subjectId}`,
    select: '*',
    limit: '1',
  })
  const response = await fetch(`${supabaseUrl}/rest/v1/staff_web_actions?${params}`, {
    headers: serviceHeaders(serviceKey),
  })
  if (!response.ok) return null
  const rows = await response.json()
  return Array.isArray(rows) ? (rows[0] as CapabilityActionRow | undefined) || null : null
}

export async function findPendingFederatedAction(
  sourceApp: string,
  subjectId: string,
  capability?: string,
) {
  const { supabaseUrl, serviceKey } = staffStoreConfig()
  const params = new URLSearchParams({
    source_app: `eq.${sourceApp}`,
    external_subject_id: `eq.${subjectId}`,
    status: 'in.(queued,running,needs_profile,needs_confirmation)',
    select: '*',
    order: 'created_at.desc',
    limit: '1',
  })
  if (capability) params.set('capability', `eq.${capability}`)
  const response = await fetch(`${supabaseUrl}/rest/v1/staff_web_actions?${params}`, {
    headers: serviceHeaders(serviceKey),
  })
  if (!response.ok) return null
  const rows = await response.json()
  return Array.isArray(rows) ? (rows[0] as CapabilityActionRow | undefined) || null : null
}

export async function findLatestFederatedAction(
  sourceApp: string,
  subjectId: string,
  capability?: string,
  hours = 2,
) {
  const { supabaseUrl, serviceKey } = staffStoreConfig()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    source_app: `eq.${sourceApp}`,
    external_subject_id: `eq.${subjectId}`,
    created_at: `gte.${since}`,
    select: '*',
    order: 'created_at.desc',
    limit: '1',
  })
  if (capability) params.set('capability', `eq.${capability}`)
  const response = await fetch(`${supabaseUrl}/rest/v1/staff_web_actions?${params}`, {
    headers: serviceHeaders(serviceKey),
  })
  if (!response.ok) return null
  const rows = await response.json()
  return Array.isArray(rows) ? (rows[0] as CapabilityActionRow | undefined) || null : null
}

export async function countRecentFederatedActions(sourceApp: string, subjectId: string, hours = 24) {
  const { supabaseUrl, serviceKey } = staffStoreConfig()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    source_app: `eq.${sourceApp}`,
    external_subject_id: `eq.${subjectId}`,
    created_at: `gte.${since}`,
    select: 'id',
    limit: '50',
  })
  const response = await fetch(`${supabaseUrl}/rest/v1/staff_web_actions?${params}`, {
    headers: serviceHeaders(serviceKey),
  })
  if (!response.ok) return 0
  const rows = await response.json()
  return Array.isArray(rows) ? rows.length : 0
}

export async function updateFederatedAction(actionId: string, updates: Record<string, unknown>) {
  const { supabaseUrl, serviceKey } = staffStoreConfig()
  const response = await fetch(
    `${supabaseUrl}/rest/v1/staff_web_actions?id=eq.${encodeURIComponent(actionId)}`,
    {
      method: 'PATCH',
      headers: serviceHeaders(serviceKey, { Prefer: 'return=representation' }),
      body: JSON.stringify(updates),
    },
  )
  if (!response.ok) throw new Error(`STAFF_STORE_UPDATE_${response.status}`)
  const rows = await response.json()
  return rows[0] as CapabilityActionRow
}
