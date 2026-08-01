import { useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import {
  findEventConflicts,
  type NewStaffEvent,
  type StaffEvent,
  type StaffRecurrenceFrequency,
} from '@/lib/staffCalendarData'
import type { StaffCategory } from '@/lib/staffData'
import { CATEGORY_LABELS, cn } from '@/lib/staffUi'

type CalendarMode = 'day' | 'week' | 'month'

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'S' },
  { value: 2, label: 'T' },
  { value: 3, label: 'Q' },
  { value: 4, label: 'Q' },
  { value: 5, label: 'S' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
]

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value: Date, amount: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function startOfWeek(value: Date) {
  const date = startOfDay(value)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return date
}

function startOfMonthGrid(value: Date) {
  const first = new Date(value.getFullYear(), value.getMonth(), 1)
  return startOfWeek(first)
}

function sameDay(a: Date | string, b: Date | string) {
  const left = new Date(a)
  const right = new Date(b)
  return left.toDateString() === right.toDateString()
}

function dateInput(value: Date | string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeInput(value: Date | string) {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function eventTime(event: StaffEvent) {
  if (event.all_day) return 'Dia inteiro'
  return `${timeInput(event.start_at)}–${timeInput(event.end_at)}`
}

function categoryStyle(category: StaffCategory) {
  const styles: Partial<Record<StaffCategory, string>> = {
    saude: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    financas: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    trabalho: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    familia: 'border-pink-500/30 bg-pink-500/10 text-pink-200',
    casa: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  }
  return styles[category] || 'border-purple-500/30 bg-purple-500/10 text-purple-200'
}

function EventChip({ event, onClick, compact = false }: { event: StaffEvent; onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick} className={cn(
      'w-full text-left rounded-xl border transition-colors hover:brightness-125',
      compact ? 'px-2 py-1.5' : 'p-3',
      categoryStyle(event.category),
    )}>
      <p className={cn('font-semibold truncate', compact ? 'text-[11px]' : 'text-sm')}>{event.title}</p>
      {!compact && <p className="text-xs opacity-70 mt-1">{eventTime(event)}</p>}
    </button>
  )
}

export function AgendaView({ events, onCreate, onUpdate, onDelete }: {
  events: StaffEvent[]
  onCreate: (input: NewStaffEvent) => Promise<StaffEvent[]>
  onUpdate: (event: StaffEvent, updates: Partial<NewStaffEvent>) => Promise<void>
  onDelete: (event: StaffEvent, wholeSeries?: boolean) => Promise<void>
}) {
  const [mode, setMode] = useState<CalendarMode>('month')
  const [anchor, setAnchor] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<StaffEvent | null>(null)

  const visibleEvents = useMemo(() => events.filter((event) => event.status === 'scheduled'), [events])
  const weekStart = startOfWeek(anchor)
  const monthGridStart = startOfMonthGrid(anchor)
  const dayEvents = visibleEvents.filter((event) => sameDay(event.start_at, anchor))
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index))

  function move(direction: number) {
    const next = new Date(anchor)
    if (mode === 'day') next.setDate(next.getDate() + direction)
    if (mode === 'week') next.setDate(next.getDate() + 7 * direction)
    if (mode === 'month') next.setMonth(next.getMonth() + direction)
    setAnchor(next)
  }

  function title() {
    if (mode === 'day') return anchor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    if (mode === 'week') {
      const end = addDays(weekStart, 6)
      return `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    }
    return anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  function openEvent(event: StaffEvent) {
    setSelected(event)
    setModalOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-purple-300 font-semibold">Agenda avançada</p>
          <h1 className="text-3xl font-black text-white">Seus compromissos em ordem.</h1>
          <p className="text-slate-500 mt-2">Dia, semana, mês, recorrências e lembretes no mesmo lugar.</p>
        </div>
        <button onClick={() => { setSelected(null); setModalOpen(true) }} className="btn-purple px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Novo evento
        </button>
      </div>

      <div className="glass-card p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => setAnchor(new Date())} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300">Hoje</button>
            <button onClick={() => move(1)} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <h2 className="font-bold text-white capitalize text-center">{title()}</h2>
          <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800">
            {(['day', 'week', 'month'] as const).map((item) => (
              <button key={item} onClick={() => setMode(item)} className={cn(
                'px-4 py-2 rounded-lg text-sm transition-colors',
                mode === item ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white',
              )}>
                {item === 'day' ? 'Dia' : item === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'day' && (
          <div className="grid lg:grid-cols-[120px_1fr] gap-4 min-h-[420px]">
            <div className="hidden lg:block text-sm text-slate-600 space-y-12 pt-2">
              {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((hour) => <div key={hour}>{hour}</div>)}
            </div>
            <div className="space-y-3">
              {dayEvents.map((event) => <EventChip key={event.id} event={event} onClick={() => openEvent(event)} />)}
              {dayEvents.length === 0 && (
                <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-2xl">
                  <CalendarDays className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="font-semibold text-white">Nenhum compromisso neste dia.</p>
                  <p className="text-sm text-slate-500 mt-1">Crie um evento ou peça ao Staff pelo chat.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const items = visibleEvents.filter((event) => sameDay(event.start_at, day))
              return (
                <div key={day.toISOString()} className={cn('min-h-[260px] rounded-2xl border p-2', sameDay(day, new Date()) ? 'border-purple-500/40 bg-purple-500/5' : 'border-slate-800 bg-slate-950/40')}>
                  <button onClick={() => { setAnchor(day); setMode('day') }} className="w-full text-center mb-3">
                    <p className="text-xs text-slate-500">{WEEKDAY_SHORT[day.getDay()]}</p>
                    <p className={cn('text-lg font-bold', sameDay(day, new Date()) ? 'text-purple-300' : 'text-white')}>{day.getDate()}</p>
                  </button>
                  <div className="space-y-2">
                    {items.map((event) => <EventChip key={event.id} event={event} compact onClick={() => openEvent(event)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {mode === 'month' && (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-slate-600">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => <div key={label} className="py-2">{label}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day) => {
                const items = visibleEvents.filter((event) => sameDay(event.start_at, day))
                const outside = day.getMonth() !== anchor.getMonth()
                return (
                  <button key={day.toISOString()} onClick={() => { setAnchor(day); setMode('day') }} className={cn(
                    'min-h-[92px] md:min-h-[126px] rounded-xl border p-1.5 text-left overflow-hidden',
                    sameDay(day, new Date()) ? 'border-purple-500/50 bg-purple-500/10' : 'border-slate-800 bg-slate-950/40',
                    outside && 'opacity-35',
                  )}>
                    <span className="text-xs text-slate-400">{day.getDate()}</span>
                    <div className="mt-1 space-y-1">
                      {items.slice(0, 3).map((event) => (
                        <div key={event.id} className={cn('rounded-md px-1.5 py-1 text-[9px] md:text-[10px] truncate border', categoryStyle(event.category))}>{event.title}</div>
                      ))}
                      {items.length > 3 && <p className="text-[9px] text-slate-500">+{items.length - 3}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <EventModal
          event={selected}
          events={events}
          initialDate={anchor}
          onClose={() => { setModalOpen(false); setSelected(null) }}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function EventModal({ event, events, initialDate, onClose, onCreate, onUpdate, onDelete }: {
  event: StaffEvent | null
  events: StaffEvent[]
  initialDate: Date
  onClose: () => void
  onCreate: (input: NewStaffEvent) => Promise<StaffEvent[]>
  onUpdate: (event: StaffEvent, updates: Partial<NewStaffEvent>) => Promise<void>
  onDelete: (event: StaffEvent, wholeSeries?: boolean) => Promise<void>
}) {
  const defaultStart = event ? new Date(event.start_at) : new Date(initialDate)
  if (!event) defaultStart.setHours(Math.max(new Date().getHours() + 1, 9), 0, 0, 0)
  const defaultEnd = event ? new Date(event.end_at) : new Date(defaultStart.getTime() + 60 * 60000)

  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [category, setCategory] = useState<StaffCategory>(event?.category || 'pessoal')
  const [date, setDate] = useState(dateInput(defaultStart))
  const [startTime, setStartTime] = useState(timeInput(defaultStart))
  const [endTime, setEndTime] = useState(timeInput(defaultEnd))
  const [location, setLocation] = useState(event?.location || '')
  const [allDay, setAllDay] = useState(Boolean(event?.all_day))
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>(event?.priority || 'normal')
  const [reminder, setReminder] = useState(String(event?.reminder_minutes?.[0] ?? 30))
  const [frequency, setFrequency] = useState<StaffRecurrenceFrequency>(event?.recurrence?.frequency || 'none')
  const [weekdays, setWeekdays] = useState<number[]>(event?.recurrence?.weekdays || [defaultStart.getDay()])
  const [untilDate, setUntilDate] = useState(dateInput(addDays(defaultStart, 90)))
  const [saving, setSaving] = useState(false)

  async function submit(formEvent: FormEvent) {
    formEvent.preventDefault()
    const startAt = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}`)
    let endAt = allDay ? addDays(startAt, 1) : new Date(`${date}T${endTime}`)
    if (endAt <= startAt) endAt = new Date(startAt.getTime() + 60 * 60000)

    const conflicts = findEventConflicts(events, startAt.toISOString(), endAt.toISOString(), event?.id)
    if (conflicts.length && !window.confirm(`Existe conflito com “${conflicts[0].title}”. Deseja salvar mesmo assim?`)) return

    const input: NewStaffEvent = {
      title,
      description,
      category,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      location,
      all_day: allDay,
      priority,
      reminder_minutes: [Number(reminder)],
      source: event ? event.source : 'manual',
      recurrence: !event && frequency !== 'none'
        ? {
            frequency,
            interval: 1,
            weekdays: frequency === 'weekly' ? weekdays : undefined,
            until_at: new Date(`${untilDate}T23:59:59`).toISOString(),
            count_limit: 104,
          }
        : null,
    }

    setSaving(true)
    if (event) await onUpdate(event, input)
    else await onCreate(input)
    setSaving(false)
    onClose()
  }

  async function remove(wholeSeries = false) {
    if (!event) return
    const message = wholeSeries ? 'Excluir todos os eventos desta série?' : 'Excluir este evento?'
    if (!window.confirm(message)) return
    await onDelete(event, wholeSeries)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center overflow-y-auto">
      <form onSubmit={submit} className="glass-card w-full max-w-2xl p-5 md:p-7 relative my-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <div className="mb-6">
          <p className="text-purple-300 text-sm font-semibold">{event ? 'Editar compromisso' : 'Agenda Staff'}</p>
          <h2 className="text-2xl font-black text-white">{event ? event.title : 'Novo evento'}</h2>
        </div>

        <div className="space-y-4">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={240} className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-500" placeholder="Título do evento" />

          <div className="grid md:grid-cols-2 gap-3">
            <label><span className="text-xs text-slate-400">Data</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>
            <label className="flex items-end"><span className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-300 flex items-center gap-3"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Dia inteiro</span></label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <label><span className="text-xs text-slate-400">Início</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>
              <label><span className="text-xs text-slate-400">Fim</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <label><span className="text-xs text-slate-400">Área</span><select value={category} onChange={(e) => setCategory(e.target.value as StaffCategory)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="text-xs text-slate-400">Prioridade</span><select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
          </div>

          <label className="block"><span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Local</span><input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" placeholder="Opcional" /></label>
          <label className="block"><span className="text-xs text-slate-400">Notas</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white resize-none" placeholder="Detalhes importantes" /></label>

          <div className="grid md:grid-cols-2 gap-3">
            <label><span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Lembrar</span><select value={reminder} onChange={(e) => setReminder(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"><option value="0">No horário</option><option value="10">10 minutos antes</option><option value="30">30 minutos antes</option><option value="60">1 hora antes</option><option value="120">2 horas antes</option><option value="1440">1 dia antes</option></select></label>
            {!event && <label><span className="text-xs text-slate-400 flex items-center gap-1"><Repeat2 className="w-3 h-3" /> Repetição</span><select value={frequency} onChange={(e) => setFrequency(e.target.value as StaffRecurrenceFrequency)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"><option value="none">Não repetir</option><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano</option></select></label>}
          </div>

          {!event && frequency !== 'none' && (
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3">
              {frequency === 'weekly' && <div><p className="text-xs text-slate-400 mb-2">Dias da semana</p><div className="flex gap-2">{WEEKDAY_OPTIONS.map((day) => <button type="button" key={day.value} onClick={() => setWeekdays((current) => current.includes(day.value) ? current.filter((item) => item !== day.value) : [...current, day.value])} className={cn('w-9 h-9 rounded-full text-xs border', weekdays.includes(day.value) ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500')}>{day.label}</button>)}</div></div>}
              <label className="block"><span className="text-xs text-slate-400">Repetir até</span><input type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            {event && <div className="flex gap-2 sm:mr-auto"><button type="button" onClick={() => remove(false)} className="px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300"><Trash2 className="w-4 h-4" /></button>{event.series_id && <button type="button" onClick={() => remove(true)} className="px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 text-sm">Excluir série</button>}</div>}
            <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300">Cancelar</button>
            <button disabled={saving} className="btn-purple px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{event ? 'Salvar alterações' : 'Criar evento'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
