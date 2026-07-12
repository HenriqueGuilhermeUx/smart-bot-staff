import { supabase } from '@/lib/supabase'

export type StaffCategory =
  | 'pessoal'
  | 'financas'
  | 'saude'
  | 'familia'
  | 'casa'
  | 'trabalho'
  | 'veiculos'
  | 'documentos'
  | 'investimentos'
  | 'eventos'
  | 'estudos'
  | 'viagens'
  | 'metas'

export type StaffTaskStatus = 'pending' | 'completed' | 'cancelled'
export type StaffTaskPriority = 'low' | 'normal' | 'high'

export interface StaffTask {
  id: string
  user_id: string
  title: string
  notes: string | null
  category: StaffCategory
  status: StaffTaskStatus
  priority: StaffTaskPriority
  due_at: string | null
  remind_at: string | null
  recurrence: string | null
  source: 'chat' | 'manual' | 'integration'
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface StaffMessage {
  id: string
  user_id: string
  thread_key: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface NewStaffTask {
  title: string
  notes?: string | null
  category?: StaffCategory
  priority?: StaffTaskPriority
  due_at?: string | null
  remind_at?: string | null
  recurrence?: string | null
  source?: 'chat' | 'manual' | 'integration'
}

const storageKey = (type: 'tasks' | 'messages', userId: string) => `staff_v2_${type}_${userId}`

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

function shouldFallback(error: any) {
  return Boolean(error)
}

export async function loadTasks(userId: string): Promise<StaffTask[]> {
  const { data, error } = await supabase
    .from('staff_tasks')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!error && data) return data as StaffTask[]
  if (shouldFallback(error)) return readLocal<StaffTask>(storageKey('tasks', userId))
  return []
}

export async function createTask(userId: string, input: NewStaffTask): Promise<StaffTask> {
  const now = new Date().toISOString()
  const task: StaffTask = {
    id: makeId(),
    user_id: userId,
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    category: input.category || 'pessoal',
    status: 'pending',
    priority: input.priority || 'normal',
    due_at: input.due_at || null,
    remind_at: input.remind_at || input.due_at || null,
    recurrence: input.recurrence || null,
    source: input.source || 'manual',
    created_at: now,
    updated_at: now,
    completed_at: null,
  }

  const { data, error } = await supabase
    .from('staff_tasks')
    .insert({
      user_id: task.user_id,
      title: task.title,
      notes: task.notes,
      category: task.category,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      remind_at: task.remind_at,
      recurrence: task.recurrence,
      source: task.source,
    })
    .select('*')
    .single()

  if (!error && data) return data as StaffTask

  const local = readLocal<StaffTask>(storageKey('tasks', userId))
  writeLocal(storageKey('tasks', userId), [task, ...local])
  return task
}

export async function updateTask(userId: string, taskId: string, updates: Partial<StaffTask>): Promise<StaffTask | null> {
  const payload: Partial<StaffTask> = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (updates.status === 'completed' && !updates.completed_at) {
    payload.completed_at = new Date().toISOString()
  }
  if (updates.status === 'pending') payload.completed_at = null

  const { data, error } = await supabase
    .from('staff_tasks')
    .update(payload)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (!error && data) return data as StaffTask

  const local = readLocal<StaffTask>(storageKey('tasks', userId))
  const index = local.findIndex((task) => task.id === taskId)
  if (index === -1) return null
  local[index] = { ...local[index], ...payload }
  writeLocal(storageKey('tasks', userId), local)
  return local[index]
}

export async function deleteTask(userId: string, taskId: string) {
  const { error } = await supabase
    .from('staff_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (!error) return
  const local = readLocal<StaffTask>(storageKey('tasks', userId)).filter((task) => task.id !== taskId)
  writeLocal(storageKey('tasks', userId), local)
}

export async function loadMessages(userId: string, threadKey = 'main'): Promise<StaffMessage[]> {
  const { data, error } = await supabase
    .from('staff_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('thread_key', threadKey)
    .order('created_at', { ascending: true })
    .limit(150)

  if (!error && data) return data as StaffMessage[]
  if (shouldFallback(error)) {
    return readLocal<StaffMessage>(storageKey('messages', userId)).filter((message) => message.thread_key === threadKey)
  }
  return []
}

export async function saveMessage(
  userId: string,
  role: StaffMessage['role'],
  content: string,
  threadKey = 'main',
): Promise<StaffMessage> {
  const message: StaffMessage = {
    id: makeId(),
    user_id: userId,
    thread_key: threadKey,
    role,
    content,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('staff_messages')
    .insert({
      user_id: userId,
      thread_key: threadKey,
      role,
      content,
    })
    .select('*')
    .single()

  if (!error && data) return data as StaffMessage

  const local = readLocal<StaffMessage>(storageKey('messages', userId))
  writeLocal(storageKey('messages', userId), [...local, message])
  return message
}

export async function clearMessages(userId: string, threadKey = 'main') {
  const { error } = await supabase
    .from('staff_messages')
    .delete()
    .eq('user_id', userId)
    .eq('thread_key', threadKey)

  if (!error) return
  const local = readLocal<StaffMessage>(storageKey('messages', userId)).filter(
    (message) => message.thread_key !== threadKey,
  )
  writeLocal(storageKey('messages', userId), local)
}
