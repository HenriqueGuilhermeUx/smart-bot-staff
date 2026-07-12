import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  ListTodo,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { NewStaffTask, StaffCategory, StaffTask } from '@/lib/staffData'
import { parseStaffCommand } from '@/lib/staffParser'
import {
  CATEGORY_LABELS,
  cn,
  formatDateTime,
  getFirstName,
  getGreeting,
  isOverdue,
  isToday,
  type StaffScreen,
} from '@/lib/staffUi'

export function TaskRow({ task, onToggle, onDelete }: {
  task: StaffTask
  onToggle: (task: StaffTask) => void
  onDelete: (task: StaffTask) => void
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 p-4 rounded-2xl border transition-colors',
      task.status === 'completed'
        ? 'bg-slate-900/30 border-slate-800 opacity-70'
        : isOverdue(task)
          ? 'bg-rose-500/5 border-rose-500/20'
          : 'bg-slate-900/65 border-slate-800 hover:border-slate-700',
    )}>
      <button onClick={() => onToggle(task)} className="shrink-0 text-purple-300">
        {task.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('font-semibold text-white truncate', task.status === 'completed' && 'line-through text-slate-500')}>{task.title}</p>
          {task.priority === 'high' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">Prioridade</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
          <span>{CATEGORY_LABELS[task.category]}</span>
          <span className={isOverdue(task) ? 'text-rose-300' : ''}>{formatDateTime(task.due_at)}</span>
        </div>
      </div>
      <button onClick={() => onDelete(task)} className="p-2 text-slate-600 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
    </div>
  )
}

export function AddTaskModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (task: NewStaffTask) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<StaffCategory>('pessoal')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    const dueAt = date ? new Date(`${date}T${time || '09:00'}`).toISOString() : null
    await onCreate({ title, category, priority, due_at: dueAt, remind_at: dueAt, source: 'manual' })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
      <form onSubmit={submit} className="glass-card w-full max-w-lg p-6 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold text-white mb-5">Nova tarefa ou lembrete</h2>
        <div className="space-y-4">
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-500" placeholder="O que você precisa lembrar?" />
          <div className="grid grid-cols-2 gap-3">
            <label><span className="text-xs text-slate-400">Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>
            <label><span className="text-xs text-slate-400">Horário</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-slate-400">Área</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as StaffCategory)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-slate-400">Prioridade</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as 'low' | 'normal' | 'high')} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white">
                <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option>
              </select>
            </label>
          </div>
          <button disabled={saving} className="w-full btn-purple py-3.5 rounded-xl font-bold flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Criar
          </button>
        </div>
      </form>
    </div>
  )
}

export function TodayView({ user, tasks, onCreate, onToggle, onDelete, onNavigate }: {
  user: any
  tasks: StaffTask[]
  onCreate: (task: NewStaffTask) => Promise<StaffTask>
  onToggle: (task: StaffTask) => void
  onDelete: (task: StaffTask) => void
  onNavigate: (screen: StaffScreen) => void
}) {
  const [quick, setQuick] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = tasks.filter((task) => task.status === 'pending')
  const today = pending.filter((task) => isToday(task.due_at))
  const overdue = pending.filter(isOverdue)
  const completedToday = tasks.filter((task) => task.status === 'completed' && task.completed_at && isToday(task.completed_at))

  async function addQuick(event: FormEvent) {
    event.preventDefault()
    if (!quick.trim()) return
    setSaving(true)
    const parsed = parseStaffCommand(quick)
    if (parsed.kind === 'create_task') await onCreate(parsed.task)
    else await onCreate({ title: quick.trim(), source: 'manual' })
    setQuick('')
    setSaving(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="!py-0">
        <p className="text-purple-300 font-semibold">{getGreeting()}, {getFirstName(user)}</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mt-1">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white">Seu dia, em um só lugar.</h1>
            <p className="text-slate-400 mt-2">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
          </div>
          <button onClick={() => onNavigate('chat')} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-200 border border-purple-500/20 hover:bg-purple-500/20">
            <MessageCircle className="w-4 h-4" /> Conversar com o Staff
          </button>
        </div>
      </section>

      <form onSubmit={addQuick} className="glass-card p-3 flex gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 text-purple-300" /></div>
        <input value={quick} onChange={(event) => setQuick(event.target.value)} className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-500 min-w-0" placeholder="Ex.: Me lembra de pagar a luz amanhã às 9h" />
        <button disabled={!quick.trim() || saving} className="btn-purple px-4 rounded-xl disabled:opacity-50">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
        </button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Hoje', String(today.length), Calendar, 'text-purple-300 bg-purple-500/10'],
          ['Atrasadas', String(overdue.length), Clock, 'text-rose-300 bg-rose-500/10'],
          ['Pendentes', String(pending.length), ListTodo, 'text-amber-300 bg-amber-500/10'],
          ['Concluídas hoje', String(completedToday.length), CheckCircle2, 'text-emerald-300 bg-emerald-500/10'],
        ].map(([label, value, Icon, style]) => (
          <div key={String(label)} className="glass-card p-5 flex items-center gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', String(style))}><Icon className="w-5 h-5" /></div>
            <div><p className="text-2xl font-black text-white">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-6">
        <section className="glass-card p-5 !py-5">
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-xl font-bold text-white">Prioridades de hoje</h2><p className="text-sm text-slate-500">O que merece sua atenção agora</p></div>
            <button onClick={() => onNavigate('tasks')} className="text-sm text-purple-300 hover:text-purple-200">Ver todas</button>
          </div>
          <div className="space-y-3">
            {[...overdue, ...today].slice(0, 6).map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />)}
            {overdue.length + today.length === 0 && (
              <div className="text-center py-10"><CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" /><p className="font-semibold text-white">Tudo em ordem por aqui.</p><p className="text-sm text-slate-500 mt-1">Adicione um lembrete para começar.</p></div>
            )}
          </div>
        </section>

        <section className="glass-card p-5 !py-5">
          <h2 className="text-xl font-bold text-white">Resumo inteligente</h2>
          <div className="mt-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-5 h-5 text-purple-300 mb-3" />
            <p className="text-sm text-slate-300 leading-relaxed">
              Você tem <strong className="text-white">{pending.length} pendência{pending.length === 1 ? '' : 's'}</strong>.{' '}
              {overdue.length > 0 ? `${overdue.length} está atrasada. Comece por ela.` : today.length > 0 ? 'Seu dia está planejado. Foque na próxima tarefa.' : 'Seu dia está livre no momento.'}
            </p>
          </div>
          <button onClick={() => onNavigate('life')} className="w-full mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between hover:border-slate-700">
            <div className="text-left"><p className="font-semibold text-white">Áreas da sua vida</p><p className="text-xs text-slate-500 mt-1">Organize saúde, finanças, casa e mais</p></div>
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </section>
      </div>
    </div>
  )
}

export function TasksView({ tasks, onCreateClick, onToggle, onDelete }: {
  tasks: StaffTask[]
  onCreateClick: () => void
  onToggle: (task: StaffTask) => void
  onDelete: (task: StaffTask) => void
}) {
  const [filter, setFilter] = useState<'pending' | 'today' | 'completed' | 'all'>('pending')
  const filtered = tasks.filter((task) => {
    if (filter === 'pending') return task.status === 'pending'
    if (filter === 'today') return task.status === 'pending' && isToday(task.due_at)
    if (filter === 'completed') return task.status === 'completed'
    return true
  })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div><p className="text-purple-300 font-semibold">Organização</p><h1 className="text-3xl font-black text-white">Tarefas e lembretes</h1></div>
        <button onClick={onCreateClick} className="btn-purple px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Nova tarefa</button>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5">
        {(['pending', 'today', 'completed', 'all'] as const).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={cn('px-4 py-2 rounded-xl text-sm whitespace-nowrap border', filter === item ? 'bg-purple-500/15 text-purple-200 border-purple-500/30' : 'bg-slate-900/50 text-slate-500 border-slate-800')}>
            {item === 'pending' ? 'Pendentes' : item === 'today' ? 'Hoje' : item === 'completed' ? 'Concluídas' : 'Todas'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />)}
        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center"><ListTodo className="w-12 h-12 text-slate-700 mx-auto mb-3" /><p className="font-semibold text-white">Nenhuma tarefa nesta lista.</p><p className="text-sm text-slate-500 mt-1">Crie uma nova tarefa ou peça ao Staff pelo chat.</p></div>
        )}
      </div>
    </div>
  )
}
