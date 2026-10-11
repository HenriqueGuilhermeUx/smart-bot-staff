import { staffFunctionUrl } from '@/lib/staffApi'
import { supabase } from '@/lib/supabase'

export type BrowserActionStatus =
  | 'running'
  | 'needs_profile'
  | 'needs_confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ReservationResult = {
  status?: string
  restaurant?: string | null
  startAt?: string | null
  partySize?: number | null
  location?: string | null
  provider?: string | null
  bookingReference?: string | null
  finalUrl?: string | null
  summary?: string
}

export type BrowserActionResponse = {
  actionId?: string
  status: BrowserActionStatus
  phase?: 'discovery' | 'booking'
  code?: string
  response?: string
  originalRequest?: string
  confirmationKind?: 'alternative_time' | 'clarification' | 'manual_takeover' | null
  alternatives?: string[]
  liveUrl?: string | null
  reservation?: ReservationResult
  result?: Record<string, unknown>
}

export class StaffBrowserActionError extends Error {
  code?: string
  status?: string
  payload?: Record<string, unknown>

  constructor(message: string, payload?: Record<string, unknown>) {
    super(message)
    this.name = 'StaffBrowserActionError'
    this.code = typeof payload?.code === 'string' ? payload.code : undefined
    this.status = typeof payload?.status === 'string' ? payload.status : undefined
    this.payload = payload
  }
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function restaurantReservationIntent(text: string) {
  const value = normalize(text)
  return /(reserv|restaurante|mesa|jantar|almoco|brunch|bistro|bar).*(pessoa|horario|hora|mesa|reserv)/.test(value)
    || /((marque|marca|agende|agenda).*(restaurante|mesa|jantar|almoco))/.test(value)
    || /(entra|acesse|abre|abra).*(site|restaurante).*(reserv|marca|agende)/.test(value)
}

async function requestBrowserAction(payload: Record<string, unknown>): Promise<BrowserActionResponse> {
  const response = await fetch(staffFunctionUrl('staff-browser-action'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    throw new StaffBrowserActionError(
      String(result.error || result.response || 'Não foi possível executar a ação na web.'),
      result,
    )
  }

  return result as unknown as BrowserActionResponse
}

export function startBrowserAction(requestText: string) {
  return requestBrowserAction({ operation: 'start', requestText })
}

export function getBrowserActionStatus(actionId: string) {
  return requestBrowserAction({ operation: 'status', actionId })
}

export function continueBrowserAction(actionId: string, selection: string) {
  return requestBrowserAction({ operation: 'continue', actionId, selection })
}

export function cancelBrowserAction(actionId: string) {
  return requestBrowserAction({ operation: 'cancel', actionId })
}

export type RestoredBrowserAction = {
  actionId: string
  mode: 'alternative_time' | 'clarification' | 'running'
  alternatives?: string[]
  originalRequest?: string
}

export async function restorePendingBrowserAction(userId: string): Promise<RestoredBrowserAction | null> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('staff_web_actions')
    .select('id,request_text,status,result_json,created_at')
    .eq('user_id', userId)
    .in('status', ['needs_confirmation', 'running'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null

  if (data.status === 'running') {
    return { actionId: data.id, mode: 'running' }
  }

  const resultJson = (data.result_json || {}) as Record<string, any>
  const kind = String(resultJson.confirmationKind || '')
  if (kind === 'alternative_time') {
    const discovery = (resultJson.discovery || {}) as Record<string, any>
    return {
      actionId: data.id,
      mode: 'alternative_time',
      alternatives: Array.isArray(discovery.alternatives) ? discovery.alternatives.slice(0, 3) : [],
      originalRequest: String(data.request_text || ''),
    }
  }

  if (kind === 'clarification') {
    return {
      actionId: data.id,
      mode: 'clarification',
      originalRequest: String(data.request_text || ''),
    }
  }

  return null
}
