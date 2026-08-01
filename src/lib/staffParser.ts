import type { NewStaffTask, StaffCategory, StaffTaskPriority } from '@/lib/staffData'
import type { NewStaffEvent, StaffRecurrence } from '@/lib/staffCalendarData'
import type { NewStaffAutomation, StaffAutomationAction } from '@/lib/staffAutomationData'

export type ParsedStaffCommand =
  | { kind: 'create_task'; task: NewStaffTask; confidence: 'high' | 'medium' }
  | { kind: 'list_tasks' }
  | { kind: 'create_event'; event: NewStaffEvent; confidence: 'high' | 'medium' }
  | { kind: 'list_events' }
  | { kind: 'create_automation'; automation: NewStaffAutomation; confidence: 'high' | 'medium' }
  | { kind: 'list_automations' }
  | { kind: 'none' }

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  terça: 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6,
}

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function setTime(date: Date, hour: number, minute = 0) {
  date.setHours(hour, minute, 0, 0)
  return date
}

function nextWeekday(now: Date, target: number) {
  const date = new Date(now)
  let delta = (target - date.getDay() + 7) % 7
  if (delta === 0) delta = 7
  date.setDate(date.getDate() + delta)
  return date
}

function parseTime(text: string): { hour: number; minute: number } | null {
  const explicit = text.match(/(?:às|as|\ba)\s*(\d{1,2})(?:h(?:(\d{2}))?|:(\d{2}))?(?:\s*horas?)?\b/i)
  const clock = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  const match = explicit || clock
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2] || match[3] || 0)
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

function parseDate(text: string, now = new Date()): Date | null {
  const normalized = stripAccents(text.toLowerCase())
  const relative = normalized.match(/daqui\s+a\s+(\d+)\s+(minuto|minutos|hora|horas|dia|dias)/)
  if (relative) {
    const amount = Number(relative[1])
    const unit = relative[2]
    const date = new Date(now)
    if (unit.startsWith('minuto')) date.setMinutes(date.getMinutes() + amount)
    if (unit.startsWith('hora')) date.setHours(date.getHours() + amount)
    if (unit.startsWith('dia')) date.setDate(date.getDate() + amount)
    return date
  }

  const time = parseTime(text)
  let date: Date | null = null

  if (normalized.includes('depois de amanha')) {
    date = new Date(now)
    date.setDate(date.getDate() + 2)
  } else if (normalized.includes('amanha')) {
    date = new Date(now)
    date.setDate(date.getDate() + 1)
  } else if (normalized.includes('hoje')) {
    date = new Date(now)
  }

  if (!date) {
    for (const [label, weekday] of Object.entries(WEEKDAYS)) {
      if (normalized.includes(stripAccents(label))) {
        date = nextWeekday(now, weekday)
        break
      }
    }
  }

  if (!date) {
    const withWord = text.match(/\bdia\s+(\d{1,2})(?:\s+de\s+([a-zç]+))?(?:\s+de\s+(\d{4}))?/i)
    const monthNames: Record<string, number> = {
      janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
      julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
    }
    if (withWord) {
      const day = Number(withWord[1])
      const monthLabel = stripAccents((withWord[2] || '').toLowerCase())
      const month = withWord[2] ? monthNames[monthLabel] : now.getMonth()
      const year = withWord[3] ? Number(withWord[3]) : now.getFullYear()
      date = new Date(year, month ?? now.getMonth(), day)
      if (!withWord[3] && date < now) date.setFullYear(date.getFullYear() + 1)
    }
  }

  if (!date) {
    const explicitDate = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/)
    if (explicitDate) {
      const day = Number(explicitDate[1])
      const month = Number(explicitDate[2]) - 1
      let year = explicitDate[3] ? Number(explicitDate[3]) : now.getFullYear()
      if (year < 100) year += 2000
      date = new Date(year, month, day)
      if (!explicitDate[3] && date < now) date.setFullYear(date.getFullYear() + 1)
    }
  }

  if (!date && time) date = new Date(now)
  if (!date) return null

  if (time) setTime(date, time.hour, time.minute)
  else if (normalized.includes('hoje')) date.setHours(Math.min(now.getHours() + 1, 23), 0, 0, 0)
  else setTime(date, 9, 0)

  return date
}

function detectCategory(text: string): StaffCategory {
  const value = stripAccents(text.toLowerCase())
  const rules: Array<[StaffCategory, string[]]> = [
    ['financas', ['boleto', 'conta', 'pagar', 'fatura', 'dinheiro', 'gasto', 'orcamento']],
    ['saude', ['remedio', 'medicamento', 'consulta', 'exame', 'vacina', 'medico', 'saude', 'dentista']],
    ['familia', ['filho', 'filha', 'familia', 'esposa', 'marido']],
    ['casa', ['mercado', 'compras', 'casa', 'condominio', 'limpeza', 'manutencao']],
    ['trabalho', ['trabalho', 'reuniao', 'cliente', 'projeto', 'prazo', 'email', 'equipe']],
    ['veiculos', ['carro', 'veiculo', 'ipva', 'oleo', 'seguro', 'revisao']],
    ['documentos', ['documento', 'rg', 'cpf', 'passaporte', 'certidao', 'renovar']],
    ['investimentos', ['bitcoin', 'dolar', 'investimento', 'aporte', 'acao', 'carteira']],
    ['eventos', ['aniversario', 'festa', 'evento', 'reserva', 'presente']],
    ['estudos', ['prova', 'escola', 'faculdade', 'curso', 'estudar', 'atividade']],
    ['viagens', ['viagem', 'hotel', 'voo', 'passagem', 'reserva']],
    ['metas', ['meta', 'objetivo', 'habito']],
  ]
  for (const [category, keywords] of rules) {
    if (keywords.some((keyword) => value.includes(keyword))) return category
  }
  return 'pessoal'
}

function detectPriority(text: string): StaffTaskPriority {
  const value = stripAccents(text.toLowerCase())
  if (/(urgente|prioridade|importante|nao posso esquecer)/.test(value)) return 'high'
  if (/(quando der|sem pressa|baixa prioridade)/.test(value)) return 'low'
  return 'normal'
}

function parseDuration(text: string) {
  const normalized = stripAccents(text.toLowerCase())
  const hours = normalized.match(/(?:por|duracao de|dura)\s*(\d+(?:[.,]\d+)?)\s*horas?/) || normalized.match(/\b(\d+)h\b/)
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60)
  const minutes = normalized.match(/(?:por|duracao de|dura)\s*(\d+)\s*minutos?/)
  if (minutes) return Number(minutes[1])
  return 60
}

function parseReminderMinutes(text: string) {
  const normalized = stripAccents(text.toLowerCase())
  const match = normalized.match(/(?:me avise|avisar|lembre|lembrar)\s*(?:com\s*)?(\d+)\s*(minutos?|horas?|dias?)\s*antes/)
  if (!match) return 30
  const value = Number(match[1])
  if (match[2].startsWith('hora')) return value * 60
  if (match[2].startsWith('dia')) return value * 1440
  return value
}

function parseRecurrence(text: string, start: Date): StaffRecurrence | null {
  const normalized = stripAccents(text.toLowerCase())
  const until = new Date(start)
  until.setFullYear(until.getFullYear() + 1)

  if (/(todo dia|todos os dias|diariamente)/.test(normalized)) return { frequency: 'daily', interval: 1, until_at: until.toISOString(), count_limit: 366 }
  if (/(todo mes|todos os meses|mensalmente)/.test(normalized)) return { frequency: 'monthly', interval: 1, until_at: until.toISOString(), count_limit: 24 }
  if (/(todo ano|anualmente)/.test(normalized)) return { frequency: 'yearly', interval: 1, until_at: until.toISOString(), count_limit: 10 }
  if (/(toda semana|semanalmente)/.test(normalized)) return { frequency: 'weekly', interval: 1, weekdays: [start.getDay()], until_at: until.toISOString(), count_limit: 104 }

  for (const [label, weekday] of Object.entries(WEEKDAYS)) {
    const clean = stripAccents(label)
    if (normalized.includes(`toda ${clean}`) || normalized.includes(`todo ${clean}`)) {
      return { frequency: 'weekly', interval: 1, weekdays: [weekday], until_at: until.toISOString(), count_limit: 104 }
    }
  }
  return null
}

function cleanCommonDateParts(text: string) {
  return text
    .replace(/daqui\s+a\s+\d+\s+(?:minutos?|horas?|dias?)/gi, '')
    .replace(/(depois de amanhã|amanhã|hoje)/gi, '')
    .replace(/(?:na\s+|nesta\s+)?(?:próxima\s+)?(segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?/gi, '')
    .replace(/\b(?:no\s+)?dia\s+\d{1,2}(?:\s+de\s+[a-zç]+)?(?:\s+de\s+\d{4})?\b/gi, '')
    .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, '')
    .replace(/(?:às|as)\s*\d{1,2}(?:h\d{0,2}|:\d{2})?(?:\s*horas?)?/gi, '')
    .replace(/\ba\s*\d{1,2}(?:h\d{0,2}|:\d{2})?(?:\s*horas?)?\b/gi, '')
    .replace(/(?:me avise|avisar|lembre|lembrar)\s*(?:com\s*)?\d+\s*(?:minutos?|horas?|dias?)\s*antes/gi, '')
    .replace(/(?:por|duração de|duracao de|dura)\s*\d+(?:[.,]\d+)?\s*(?:minutos?|horas?)/gi, '')
    .replace(/\b(?:todo dia|todos os dias|diariamente|toda semana|semanalmente|todo mês|todos os meses|mensalmente|todo ano|anualmente)\b/gi, '')
}

function cleanTaskTitle(text: string) {
  return cleanCommonDateParts(text)
    .replace(/^(staff[,\s:]*)/i, '')
    .replace(/^(por favor[,\s]*)/i, '')
    .replace(/^(me\s+lembre|me\s+lembra|lembre-me|crie\s+um\s+lembrete|criar\s+um\s+lembrete|adicione\s+uma\s+tarefa|adicionar\s+uma\s+tarefa|anote|preciso|tenho\s+que|não\s+posso\s+esquecer|nao\s+posso\s+esquecer)\s+(de\s+)?/i, '')
    .replace(/\b(?:urgente|importante|prioridade)\b/gi, '')
    .replace(/^\s*(?:de|do|da|para)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '')
    .trim()
}

function cleanEventTitle(text: string) {
  return cleanCommonDateParts(text)
    .replace(/^(staff[,\s:]*)/i, '')
    .replace(/^(por favor[,\s]*)/i, '')
    .replace(/^(agende|agenda|marque|marca|crie\s+um\s+evento|criar\s+um\s+evento|adicione\s+(?:um\s+)?(?:evento\s+)?(?:na|à)\s+agenda|coloque\s+na\s+agenda)\s*/i, '')
    .replace(/^(uma|um|a|o)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '')
    .trim()
}

function parseAutomation(text: string): NewStaffAutomation | null {
  const normalized = stripAccents(text.toLowerCase())
  const explicit = normalized.includes('automacao') || /(todo dia|toda semana|a cada \d+ horas?).*(resumo|planejamento|avise|lembre)/.test(normalized)
  if (!explicit) return null

  let action: StaffAutomationAction = 'notification'
  if (normalized.includes('resumo') && normalized.includes('semana')) action = 'weekly_review'
  else if (normalized.includes('resumo')) action = 'daily_brief'
  else if (normalized.includes('planej')) action = 'morning_plan'
  else if (normalized.includes('atrasad')) action = 'overdue_tasks'
  else if (normalized.includes('amanha') && /(agenda|evento|compromisso)/.test(normalized)) action = 'tomorrow_events'

  let frequency: NewStaffAutomation['frequency'] = 'daily'
  let interval = 1
  let weekday: number | undefined
  const intervalMatch = normalized.match(/a cada\s+(\d+)\s+horas?/)
  if (intervalMatch) {
    frequency = 'hourly'
    interval = Number(intervalMatch[1])
  } else if (normalized.includes('semana')) {
    frequency = 'weekly'
    for (const [label, value] of Object.entries(WEEKDAYS)) {
      if (normalized.includes(stripAccents(label))) weekday = value
    }
  }

  const parsedTime = parseTime(text)
  const time = parsedTime ? `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}` : frequency === 'weekly' ? '18:00' : '07:00'
  const name = action === 'daily_brief' ? 'Resumo diário' : action === 'weekly_review' ? 'Revisão semanal' : action === 'morning_plan' ? 'Planejamento da manhã' : action === 'overdue_tasks' ? 'Tarefas atrasadas' : action === 'tomorrow_events' ? 'Compromissos de amanhã' : 'Automação personalizada'

  return {
    name,
    description: text.trim(),
    frequency,
    interval,
    weekday,
    time,
    action_type: action,
    enabled: true,
  }
}

export function parseStaffCommand(text: string, now = new Date()): ParsedStaffCommand {
  const normalized = stripAccents(text.toLowerCase().trim())

  if (/(minhas automacoes|automacoes ativas|listar automacoes)/.test(normalized)) return { kind: 'list_automations' }
  if (/(minha agenda|meus compromissos|proximos eventos|agenda de hoje|agenda de amanha|o que tenho na agenda)/.test(normalized)) return { kind: 'list_events' }
  if (/(minhas tarefas|tarefas pendentes|meus lembretes|contas a pagar)/.test(normalized)) return { kind: 'list_tasks' }

  const automation = parseAutomation(text)
  if (automation) return { kind: 'create_automation', automation, confidence: normalized.includes('automacao') ? 'high' : 'medium' }

  const eventDate = parseDate(text, now)
  const explicitEvent = /(agende|agenda|marque|marca|crie um evento|criar um evento|adicione.*agenda|coloque.*agenda)/.test(normalized)
  const implicitEvent = Boolean(eventDate) && /(reuniao|consulta|compromisso|evento|aniversario|dentista|medico|voo|reserva)/.test(normalized)
  if (eventDate && (explicitEvent || implicitEvent)) {
    const duration = parseDuration(text)
    const end = new Date(eventDate.getTime() + duration * 60000)
    const title = cleanEventTitle(text) || 'Novo compromisso'
    return {
      kind: 'create_event',
      confidence: explicitEvent ? 'high' : 'medium',
      event: {
        title: title.charAt(0).toUpperCase() + title.slice(1),
        category: detectCategory(text),
        priority: detectPriority(text),
        start_at: eventDate.toISOString(),
        end_at: end.toISOString(),
        reminder_minutes: [parseReminderMinutes(text)],
        recurrence: parseRecurrence(text, eventDate),
        source: 'chat',
      },
    }
  }

  const explicitTask = /(me lembre|me lembra|lembre-me|crie um lembrete|criar um lembrete|adicione uma tarefa|adicionar uma tarefa|anote)/.test(normalized)
  const implicitTask = /^(preciso|tenho que|nao posso esquecer)/.test(normalized)
  if (!explicitTask && !implicitTask) return { kind: 'none' }

  const title = cleanTaskTitle(text)
  if (!title) return { kind: 'none' }
  const dueDate = parseDate(text, now)

  return {
    kind: 'create_task',
    confidence: explicitTask ? 'high' : 'medium',
    task: {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      category: detectCategory(text),
      priority: detectPriority(text),
      due_at: dueDate?.toISOString() || null,
      remind_at: dueDate?.toISOString() || null,
      source: 'chat',
    },
  }
}
