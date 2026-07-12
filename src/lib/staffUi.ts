import type { StaffCategory, StaffTask } from '@/lib/staffData'

export type StaffScreen = 'today' | 'chat' | 'tasks' | 'life' | 'settings'
export type AuthMode = 'login' | 'signup'

export const CATEGORY_LABELS: Record<StaffCategory, string> = {
  pessoal: 'Pessoal',
  financas: 'Finanças',
  saude: 'Saúde',
  familia: 'Família',
  casa: 'Casa',
  trabalho: 'Trabalho',
  veiculos: 'Veículos',
  documentos: 'Documentos',
  investimentos: 'Investimentos',
  eventos: 'Eventos',
  estudos: 'Estudos',
  viagens: 'Viagens',
  metas: 'Metas',
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function getFirstName(user: any) {
  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'você'
  return String(name).trim().split(' ')[0]
}

export function formatDateTime(value: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const day = sameDay(date, today)
    ? 'Hoje'
    : sameDay(date, tomorrow)
      ? 'Amanhã'
      : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return `${day}, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export function isToday(value: string | null) {
  return Boolean(value) && new Date(value as string).toDateString() === new Date().toDateString()
}

export function isOverdue(task: StaffTask) {
  return task.status === 'pending' && Boolean(task.due_at) && new Date(task.due_at as string).getTime() < Date.now()
}
