import { supabase } from '@/lib/supabase'
import type { StaffCategory, StaffTaskPriority } from '@/lib/staffData'

export type StaffEventStatus = 'scheduled' | 'completed' | 'cancelled'
export type StaffEventSource = 'manual' | 'chat' | 'automation' | 'integration'
export type StaffRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface StaffRecurrence {
  frequency: StaffRecurrenceFrequency
  interval: number
  weekdays?: number[]
  until_at?: string | null
  count_limit?: number | null
}

export interface StaffEvent {
  id: string
  user_id: string
  series_id: string | null
  parent_event_id: string | null
  title: string
  description: string | null
  category: StaffCategory
  start_at: string
  end_at: string
  timezone: string
  location: string | null
  status: StaffEventStatus
  priority: StaffTaskPriority
  all_day: boolean
  source: StaffEventSource
  created_at: string
  updated_at: string
  reminder_minutes: number[]
  recurrence: StaffRecurrence | null
}

export interface NewStaffEvent {
  title: string
  description?: string | null
  category?: StaffCategory
  start_at: string
  end_at: string
  timezone?: string
  location?: string | null
  priority?: StaffTaskPriority
  all_day?: boolean
  source?: StaffEventSource
  reminder_minutes?: number[]
  recurrence?: StaffRecurrence | null
}

const storageKey = (userId: string) => `staff_v2_events_${userId}`

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-0000-4000-8000-000000000000`.slice(0, 36)
}

function readLocal(userId: string): StaffEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocal(userId: string, events: StaffEvent[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(events))
}

function normalizeEvent(row: any): StaffEvent {
  const reminders = Array.isArray(row.staff_event_reminders)
    ? row.staff_event_reminders.map((item: any) => Number(item.minutes_before)).filter(Number.isFinite)
    : Array.isArray(row.reminder_minutes)
      ? row.reminder_minutes
      : []

  const recurrenceRow = Array.isArray(row.staff_event_recurrences)
    ? row.staff_event_recurrences[0]
    : row.staff_event_recurrences || row.recurrence

  return {
    ...row,
    reminder_minutes: reminders.length ? reminders : [30],
    recurrence: recurrenceRow
      ? {
          frequency: recurrenceRow.frequency,
          interval: Number(recurrenceRow.interval_value || recurrenceRow.interval || 1),
          weekdays: recurrenceRow.weekdays || [],
          until_at: recurrenceRow.until_at || null,
          count_limit: recurrenceRow.count_limit || null,
        }
      : null,
  } as StaffEvent
}

export async function loadEvents(userId: string, from?: Date, to?: Date): Promise<StaffEvent[]> {
  let query = supabase
    .from('staff_events')
    .select('*, staff_event_reminders(minutes_before), staff_event_recurrences(*)')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true })

  if (from) query = query.gte('start_at', from.toISOString())
  if (to) query = query.lt('start_at', to.toISOString())

  const { data, error } = await query
  if (!error && data) return data.map(normalizeEvent)

  return readLocal(userId)
    .filter((event) => event.status !== 'cancelled')
    .filter((event) => !from || new Date(event.start_at) >= from)
    .filter((event) => !to || new Date(event.start_at) < to)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
}

function addDays(value: Date, amount: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function addMonths(value: Date, amount: number) {
  const date = new Date(value)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + amount)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return date
}

function addYears(value: Date, amount: number) {
  const date = new Date(value)
  date.setFullYear(date.getFullYear() + amount)
  return date
}

function generateOccurrenceStarts(start: Date, recurrence?: StaffRecurrence | null) {
  if (!recurrence || recurrence.frequency === 'none') return [start]

  const result = [start]
  const interval = Math.max(1, recurrence.interval || 1)
  const limit = Math.min(366, Math.max(1, recurrence.count_limit || 52))
  const until = recurrence.until_at ? new Date(recurrence.until_at) : addYears(start, 1)

  if (recurrence.frequency === 'weekly') {
    const weekdays = recurrence.weekdays?.length ? recurrence.weekdays : [start.getDay()]
    let candidate = addDays(start, 1)
    while (candidate <= until && result.length < limit) {
      const daysSinceStart = Math.floor((candidate.getTime() - start.getTime()) / 86400000)
      const weekIndex = Math.floor(daysSinceStart / 7)
      if (weekIndex % interval === 0 && weekdays.includes(candidate.getDay())) result.push(new Date(candidate))
      candidate = addDays(candidate, 1)
    }
    return result
  }

  let candidate = new Date(start)
  while (result.length < limit) {
    if (recurrence.frequency === 'daily') candidate = addDays(candidate, interval)
    if (recurrence.frequency === 'monthly') candidate = addMonths(candidate, interval)
    if (recurrence.frequency === 'yearly') candidate = addYears(candidate, interval)
    if (candidate > until) break
    result.push(new Date(candidate))
  }
  return result
}

export async function createEvent(userId: string, input: NewStaffEvent): Promise<StaffEvent[]> {
  const start = new Date(input.start_at)
  const end = new Date(input.end_at)
  const duration = Math.max(60000, end.getTime() - start.getTime())
  const starts = generateOccurrenceStarts(start, input.recurrence)
  const seriesId = starts.length > 1 ? makeId() : null
  const baseId = makeId()
  const now = new Date().toISOString()
  const reminderMinutes = (input.reminder_minutes?.length ? input.reminder_minutes : [30])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0)

  const events: StaffEvent[] = starts.map((occurrenceStart, index) => ({
    id: index === 0 ? baseId : makeId(),
    user_id: userId,
    series_id: seriesId,
    parent_event_id: index === 0 ? null : baseId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category || 'pessoal',
    start_at: occurrenceStart.toISOString(),
    end_at: new Date(occurrenceStart.getTime() + duration).toISOString(),
    timezone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    location: input.location?.trim() || null,
    status: 'scheduled',
    priority: input.priority || 'normal',
    all_day: Boolean(input.all_day),
    source: input.source || 'manual',
    created_at: now,
    updated_at: now,
    reminder_minutes: reminderMinutes,
    recurrence: index === 0 ? input.recurrence || null : null,
  }))

  const rows = events.map(({ reminder_minutes: _reminders, recurrence: _recurrence, ...event }) => event)
  const { data, error } = await supabase.from('staff_events').insert(rows).select('*')

  if (!error && data) {
    const inserted = data.map((row: any) => events.find((event) => event.id === row.id) || normalizeEvent(row))
    const reminderRows = inserted.flatMap((event) => reminderMinutes.map((minutesBefore) => ({
      event_id: event.id,
      user_id: userId,
      minutes_before: minutesBefore,
      channel: 'local',
    })))

    if (reminderRows.length) await supabase.from('staff_event_reminders').insert(reminderRows)

    if (input.recurrence && input.recurrence.frequency !== 'none') {
      await supabase.from('staff_event_recurrences').insert({
        event_id: baseId,
        user_id: userId,
        frequency: input.recurrence.frequency,
        interval_value: input.recurrence.interval || 1,
        weekdays: input.recurrence.weekdays || [],
        month_day: start.getDate(),
        until_at: input.recurrence.until_at || null,
        count_limit: input.recurrence.count_limit || null,
      })
    }

    return inserted
  }

  const local = readLocal(userId)
  writeLocal(userId, [...local, ...events])
  return events
}

export async function updateEvent(userId: string, eventId: string, updates: Partial<NewStaffEvent & { status: StaffEventStatus }>): Promise<StaffEvent | null> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowed = ['title', 'description', 'category', 'start_at', 'end_at', 'timezone', 'location', 'priority', 'all_day', 'status'] as const
  allowed.forEach((key) => {
    if (updates[key] !== undefined) payload[key] = updates[key]
  })

  const { data, error } = await supabase
    .from('staff_events')
    .update(payload)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select('*, staff_event_reminders(minutes_before), staff_event_recurrences(*)')
    .single()

  if (!error && data) {
    if (updates.reminder_minutes) {
      await supabase.from('staff_event_reminders').delete().eq('event_id', eventId).eq('user_id', userId)
      if (updates.reminder_minutes.length) {
        await supabase.from('staff_event_reminders').insert(updates.reminder_minutes.map((minutesBefore) => ({
          event_id: eventId,
          user_id: userId,
          minutes_before: minutesBefore,
          channel: 'local',
        })))
      }
    }
    return normalizeEvent({ ...data, reminder_minutes: updates.reminder_minutes })
  }

  const local = readLocal(userId)
  const index = local.findIndex((event) => event.id === eventId)
  if (index < 0) return null
  local[index] = { ...local[index], ...updates, updated_at: new Date().toISOString() } as StaffEvent
  writeLocal(userId, local)
  return local[index]
}

export async function deleteEvent(userId: string, event: StaffEvent, wholeSeries = false) {
  let query = supabase.from('staff_events').delete().eq('user_id', userId)
  query = wholeSeries && event.series_id ? query.eq('series_id', event.series_id) : query.eq('id', event.id)
  const { error } = await query
  if (!error) return

  const local = readLocal(userId).filter((item) => wholeSeries && event.series_id ? item.series_id !== event.series_id : item.id !== event.id)
  writeLocal(userId, local)
}

export function findEventConflicts(events: StaffEvent[], startAt: string, endAt: string, ignoreId?: string) {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  return events.filter((event) => {
    if (event.id === ignoreId || event.status !== 'scheduled' || event.all_day) return false
    const eventStart = new Date(event.start_at).getTime()
    const eventEnd = new Date(event.end_at).getTime()
    return start < eventEnd && end > eventStart
  })
}
