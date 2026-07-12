import type { NewStaffTask, StaffCategory, StaffTaskPriority } from '@/lib/staffData'

export type ParsedStaffCommand =
  | { kind: 'create_task'; task: NewStaffTask; confidence: 'high' | 'medium' }
  | { kind: 'list_tasks' }
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

  if (time) {
    setTime(date, time.hour, time.minute)
  } else if (normalized.includes('hoje')) {
    date.setHours(Math.min(now.getHours() + 1, 23), 0, 0, 0)
  } else {
    setTime(date, 9, 0)
  }

  return date
}

function detectCategory(text: string): StaffCategory {
  const value = stripAccents(text.toLowerCase())
  const rules: Array<[StaffCategory, string[]]> = [
    ['financas', ['boleto', 'conta', 'pagar', 'fatura', 'dinheiro', 'gasto', 'orcamento']],
    ['saude', ['remedio', 'medicamento', 'consulta', 'exame', 'vacina', 'medico', 'saude']],
    ['familia', ['filho', 'filha', 'joao', 'maria', 'familia', 'esposa', 'marido']],
    ['casa', ['mercado', 'compras', 'casa', 'condominio', 'limpeza', 'manutencao']],
    ['trabalho', ['trabalho', 'reuniao', 'cliente', 'projeto', 'prazo', 'email']],
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

function cleanTaskTitle(text: string) {
  return text
    .replace(/^(staff[,\s:]*)/i, '')
    .replace(/^(por favor[,\s]*)/i, '')
    .replace(/^(me\s+lembre|me\s+lembra|lembre-me|crie\s+um\s+lembrete|criar\s+um\s+lembrete|adicione\s+uma\s+tarefa|adicionar\s+uma\s+tarefa|anote|preciso|tenho\s+que|não\s+posso\s+esquecer|nao\s+posso\s+esquecer)\s+(de\s+)?/i, '')
    .replace(/daqui\s+a\s+\d+\s+(?:minutos?|horas?|dias?)/gi, '')
    .replace(/(depois de amanhã|amanhã|hoje)/gi, '')
    .replace(/(?:na\s+|nesta\s+)?(?:próxima\s+)?(segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?/gi, '')
    .replace(/\b(?:no\s+)?dia\s+\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/gi, '')
    .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, '')
    .replace(/(?:às|as)\s*\d{1,2}(?:h\d{0,2}|:\d{2})?(?:\s*horas?)?/gi, '')
    .replace(/\ba\s*\d{1,2}(?:h\d{0,2}|:\d{2})?(?:\s*horas?)?\b/gi, '')
    .replace(/\b(?:urgente|importante|prioridade)\b/gi, '')
    .replace(/^\s*(?:de|do|da|para)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '')
    .trim()
}

export function parseStaffCommand(text: string, now = new Date()): ParsedStaffCommand {
  const normalized = stripAccents(text.toLowerCase().trim())

  if (/(meus lembretes|minhas tarefas|o que tenho hoje|agenda de hoje|tarefas pendentes|contas a pagar)/.test(normalized)) {
    return { kind: 'list_tasks' }
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
