import { supabase } from '@/lib/supabase'

export type StaffAutomationAction =
  | 'daily_brief'
  | 'morning_plan'
  | 'weekly_review'
  | 'overdue_tasks'
  | 'tomorrow_events'
  | 'notification'

export type StaffAutomationFrequency = 'hourly' | 'daily' | 'weekly'

export interface StaffAutomation {
  id: string
  user_id: string
  template_key: string | null
  name: string
  description: string | null
  enabled: boolean
  trigger_type: 'schedule' | 'event' | 'task'
  trigger_config: {
    frequency?: StaffAutomationFrequency
    interval?: number
    weekday?: number
    time?: string
    timezone?: string
  }
  action_type: StaffAutomationAction
  action_config: Record<string, unknown>
  requires_confirmation: boolean
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface NewStaffAutomation {
  name: string
  description?: string | null
  enabled?: boolean
  frequency: StaffAutomationFrequency
  interval?: number
  weekday?: number
  time?: string
  action_type: StaffAutomationAction
  action_config?: Record<string, unknown>
  requires_confirmation?: boolean
  template_key?: string | null
}

export interface StaffNotificationItem {
  id: string
  user_id: string
  automation_id: string | null
  event_id: string | null
  task_id: string | null
  title: string
  body: string
  category: string
  dedupe_key: string
  read_at: string | null
  created_at: string
}

const automationStorageKey = (userId: string) => `staff_v2_automations_${userId}`
const notificationStorageKey = (userId: string) => `staff_v2_notifications_${userId}`

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocal<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

function nextTime(time: string, dayOffset = 0) {
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour || 0, minute || 0, 0, 0)
  if (date <= new Date()) date.setDate(date.getDate() + 1)
  return date
}

export function computeNextRun(input: Pick<NewStaffAutomation, 'frequency' | 'interval' | 'weekday' | 'time'>) {
  if (input.frequency === 'hourly') {
    const date = new Date()
    date.setMinutes(0, 0, 0)
    date.setHours(date.getHours() + Math.max(1, input.interval || 1))
    return date.toISOString()
  }

  if (input.frequency === 'weekly') {
    const target = input.weekday ?? 0
    const now = new Date()
    const delta = (target - now.getDay() + 7) % 7
    const date = nextTime(input.time || '18:00', delta)
    if (delta === 0 && date.getTime() - now.getTime() > 6 * 86400000) date.setDate(date.getDate() - 7)
    return date.toISOString()
  }

  return nextTime(input.time || '07:00').toISOString()
}

export const AUTOMATION_TEMPLATES: Array<Omit<NewStaffAutomation, 'enabled'> & { template_key: string; enabled: boolean }> = [
  {
    template_key: 'daily_brief',
    name: 'Resumo diário',
    description: 'Resumo de tarefas, atrasos e compromissos do dia.',
    enabled: true,
    frequency: 'daily',
    time: '07:00',
    action_type: 'daily_brief',
  },
  {
    template_key: 'morning_plan',
    name: 'Planejamento da manhã',
    description: 'Sugere a prioridade principal e organiza o início do dia.',
    enabled: false,
    frequency: 'daily',
    time: '08:00',
    action_type: 'morning_plan',
  },
  {
    template_key: 'overdue_tasks',
    name: 'Tarefas atrasadas',
    description: 'Avisa quando existirem tarefas pendentes vencidas.',
    enabled: true,
    frequency: 'hourly',
    interval: 2,
    action_type: 'overdue_tasks',
  },
  {
    template_key: 'tomorrow_events',
    name: 'Compromissos de amanhã',
    description: 'No fim do dia, mostra os compromissos do dia seguinte.',
    enabled: true,
    frequency: 'daily',
    time: '18:00',
    action_type: 'tomorrow_events',
  },
  {
    template_key: 'weekly_review',
    name: 'Revisão semanal',
    description: 'Resume a semana concluída e o que ainda está pendente.',
    enabled: false,
    frequency: 'weekly',
    weekday: 0,
    time: '18:00',
    action_type: 'weekly_review',
  },
]

function localTemplates(userId: string): StaffAutomation[] {
  const now = new Date().toISOString()
  return AUTOMATION_TEMPLATES.map((template) => ({
    id: makeId(),
    user_id: userId,
    template_key: template.template_key,
    name: template.name,
    description: template.description || null,
    enabled: template.enabled,
    trigger_type: 'schedule',
    trigger_config: {
      frequency: template.frequency,
      interval: template.interval,
      weekday: template.weekday,
      time: template.time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    },
    action_type: template.action_type,
    action_config: template.action_config || {},
    requires_confirmation: Boolean(template.requires_confirmation),
    next_run_at: computeNextRun(template),
    last_run_at: null,
    created_at: now,
    updated_at: now,
  }))
}

export async function loadAutomations(userId: string): Promise<StaffAutomation[]> {
  const { data, error } = await supabase
    .from('staff_automations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (!error && data?.length) return data as StaffAutomation[]

  if (!error && data?.length === 0) {
    const seeded = await supabase.rpc('staff_seed_automation_templates')
    if (!seeded.error && seeded.data) return seeded.data as StaffAutomation[]
  }

  const local = readLocal<StaffAutomation>(automationStorageKey(userId))
  if (local.length) return local
  const templates = localTemplates(userId)
  writeLocal(automationStorageKey(userId), templates)
  return templates
}

export async function createAutomation(userId: string, input: NewStaffAutomation): Promise<StaffAutomation> {
  const now = new Date().toISOString()
  const automation: StaffAutomation = {
    id: makeId(),
    user_id: userId,
    template_key: input.template_key || null,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    enabled: input.enabled ?? true,
    trigger_type: 'schedule',
    trigger_config: {
      frequency: input.frequency,
      interval: input.interval || 1,
      weekday: input.weekday,
      time: input.time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    },
    action_type: input.action_type,
    action_config: input.action_config || {},
    requires_confirmation: Boolean(input.requires_confirmation),
    next_run_at: computeNextRun(input),
    last_run_at: null,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase.from('staff_automations').insert(automation).select('*').single()
  if (!error && data) return data as StaffAutomation

  const local = readLocal<StaffAutomation>(automationStorageKey(userId))
  writeLocal(automationStorageKey(userId), [...local, automation])
  return automation
}

export async function toggleAutomation(userId: string, automation: StaffAutomation): Promise<StaffAutomation> {
  const enabled = !automation.enabled
  const nextRunAt = enabled
    ? computeNextRun({
        frequency: automation.trigger_config.frequency || 'daily',
        interval: automation.trigger_config.interval,
        weekday: automation.trigger_config.weekday,
        time: automation.trigger_config.time,
      })
    : automation.next_run_at

  const { data, error } = await supabase
    .from('staff_automations')
    .update({ enabled, next_run_at: nextRunAt, updated_at: new Date().toISOString() })
    .eq('id', automation.id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (!error && data) return data as StaffAutomation

  const updated = { ...automation, enabled, next_run_at: nextRunAt, updated_at: new Date().toISOString() }
  const local = readLocal<StaffAutomation>(automationStorageKey(userId)).map((item) => item.id === automation.id ? updated : item)
  writeLocal(automationStorageKey(userId), local)
  return updated
}

export async function deleteAutomation(userId: string, automationId: string) {
  const { error } = await supabase.from('staff_automations').delete().eq('id', automationId).eq('user_id', userId)
  if (!error) return
  const local = readLocal<StaffAutomation>(automationStorageKey(userId)).filter((item) => item.id !== automationId)
  writeLocal(automationStorageKey(userId), local)
}

export async function loadNotifications(userId: string): Promise<StaffNotificationItem[]> {
  const { data, error } = await supabase
    .from('staff_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!error && data) return data as StaffNotificationItem[]
  return readLocal<StaffNotificationItem>(notificationStorageKey(userId))
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const readAt = new Date().toISOString()
  const { error } = await supabase
    .from('staff_notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (!error) return
  const local = readLocal<StaffNotificationItem>(notificationStorageKey(userId)).map((item) => item.id === notificationId ? { ...item, read_at: readAt } : item)
  writeLocal(notificationStorageKey(userId), local)
}
