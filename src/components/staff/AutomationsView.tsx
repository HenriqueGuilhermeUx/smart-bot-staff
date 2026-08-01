import { useState, type FormEvent } from 'react'
import {
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import {
  type NewStaffAutomation,
  type StaffAutomation,
  type StaffAutomationAction,
  type StaffAutomationFrequency,
  type StaffNotificationItem,
} from '@/lib/staffAutomationData'
import { cn, formatDateTime } from '@/lib/staffUi'

const ACTION_LABELS: Record<StaffAutomationAction, string> = {
  daily_brief: 'Resumo diário',
  morning_plan: 'Planejamento da manhã',
  weekly_review: 'Revisão semanal',
  overdue_tasks: 'Tarefas atrasadas',
  tomorrow_events: 'Compromissos de amanhã',
  notification: 'Notificação personalizada',
}

function scheduleLabel(automation: StaffAutomation) {
  const config = automation.trigger_config
  if (config.frequency === 'hourly') return `A cada ${config.interval || 1} hora(s)`
  if (config.frequency === 'weekly') return `Semanalmente às ${config.time || '18:00'}`
  return `Diariamente às ${config.time || '07:00'}`
}

export function AutomationsView({ automations, notifications, onToggle, onCreate, onDelete, onRefreshNotifications, onMarkRead }: {
  automations: StaffAutomation[]
  notifications: StaffNotificationItem[]
  onToggle: (automation: StaffAutomation) => Promise<void>
  onCreate: (input: NewStaffAutomation) => Promise<void>
  onDelete: (automation: StaffAutomation) => Promise<void>
  onRefreshNotifications: () => Promise<void>
  onMarkRead: (notification: StaffNotificationItem) => Promise<void>
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const activeCount = automations.filter((automation) => automation.enabled).length
  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  async function refresh() {
    setRefreshing(true)
    await onRefreshNotifications()
    setRefreshing(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-purple-300 font-semibold">Proatividade</p>
          <h1 className="text-3xl font-black text-white">Automações do Staff</h1>
          <p className="text-slate-500 mt-2">Regras que acompanham sua rotina e avisam na hora certa.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-purple px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Nova automação</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center"><Zap className="w-5 h-5 text-purple-300" /></div><div><p className="text-2xl font-black text-white">{activeCount}</p><p className="text-sm text-slate-500">Ativas</p></div></div>
        <div className="glass-card p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center"><BellRing className="w-5 h-5 text-amber-300" /></div><div><p className="text-2xl font-black text-white">{unreadCount}</p><p className="text-sm text-slate-500">Avisos novos</p></div></div>
        <div className="glass-card p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center"><CalendarClock className="w-5 h-5 text-emerald-300" /></div><div><p className="text-2xl font-black text-white">5 min</p><p className="text-sm text-slate-500">Ciclo do motor</p></div></div>
      </div>

      <section className="glass-card p-5 md:p-6">
        <div className="mb-5"><h2 className="text-xl font-bold text-white">Regras configuradas</h2><p className="text-sm text-slate-500 mt-1">Ative apenas o que fizer sentido para sua rotina.</p></div>
        <div className="grid md:grid-cols-2 gap-4">
          {automations.map((automation) => (
            <div key={automation.id} className={cn('p-5 rounded-2xl border transition-colors', automation.enabled ? 'bg-purple-500/5 border-purple-500/25' : 'bg-slate-950/50 border-slate-800')}>
              <div className="flex items-start justify-between gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0"><Sparkles className={cn('w-5 h-5', automation.enabled ? 'text-purple-300' : 'text-slate-600')} /></div>
                <button onClick={() => onToggle(automation)} className={cn('w-12 h-7 rounded-full p-1 transition-colors', automation.enabled ? 'bg-purple-600' : 'bg-slate-800')} aria-label={automation.enabled ? 'Desativar automação' : 'Ativar automação'}><span className={cn('block w-5 h-5 rounded-full bg-white transition-transform', automation.enabled && 'translate-x-5')} /></button>
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-white">{automation.name}</h3>
                <p className="text-sm text-slate-500 mt-1 min-h-[40px]">{automation.description}</p>
                <div className="flex flex-wrap gap-2 mt-4 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1"><Clock3 className="w-3 h-3" /> {scheduleLabel(automation)}</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">{ACTION_LABELS[automation.action_type]}</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/70">
                  <p className="text-[11px] text-slate-600">Próxima: {formatDateTime(automation.next_run_at)}</p>
                  {!automation.template_key && <button onClick={() => onDelete(automation)} className="p-2 text-slate-600 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div><h2 className="text-xl font-bold text-white">Caixa do Staff</h2><p className="text-sm text-slate-500 mt-1">Resumos e alertas produzidos pelas automações.</p></div>
          <button onClick={refresh} disabled={refreshing} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-300"><RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} /></button>
        </div>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <button key={notification.id} onClick={() => onMarkRead(notification)} className={cn('w-full p-4 rounded-2xl border text-left flex gap-4 transition-colors', notification.read_at ? 'bg-slate-950/30 border-slate-800 opacity-70' : 'bg-purple-500/5 border-purple-500/20')}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', notification.read_at ? 'bg-slate-900' : 'bg-purple-500/15')}>
                {notification.read_at ? <Check className="w-4 h-4 text-slate-500" /> : <BellRing className="w-4 h-4 text-purple-300" />}
              </div>
              <div className="flex-1"><p className="font-semibold text-white">{notification.title}</p><p className="text-sm text-slate-400 mt-1">{notification.body}</p><p className="text-[11px] text-slate-600 mt-2">{new Date(notification.created_at).toLocaleString('pt-BR')}</p></div>
            </button>
          ))}
          {notifications.length === 0 && <div className="py-10 text-center"><BellRing className="w-11 h-11 text-slate-700 mx-auto mb-3" /><p className="font-semibold text-white">Nenhum aviso ainda.</p><p className="text-sm text-slate-500 mt-1">As automações ativas começarão a preencher esta área.</p></div>}
        </div>
      </section>

      {showCreate && <CreateAutomationModal onClose={() => setShowCreate(false)} onCreate={onCreate} />}
    </div>
  )
}

function CreateAutomationModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: NewStaffAutomation) => Promise<void> }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<StaffAutomationFrequency>('daily')
  const [interval, setIntervalValue] = useState(2)
  const [weekday, setWeekday] = useState(1)
  const [time, setTime] = useState('08:00')
  const [action, setAction] = useState<StaffAutomationAction>('notification')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    await onCreate({
      name,
      description,
      frequency,
      interval: frequency === 'hourly' ? interval : 1,
      weekday: frequency === 'weekly' ? weekday : undefined,
      time: frequency === 'hourly' ? undefined : time,
      action_type: action,
      enabled: true,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center overflow-y-auto">
      <form onSubmit={submit} className="glass-card w-full max-w-xl p-6 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <p className="text-purple-300 text-sm font-semibold">Regra personalizada</p>
        <h2 className="text-2xl font-black text-white mb-6">Nova automação</h2>
        <div className="space-y-4">
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} required className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" placeholder="Nome da automação" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white resize-none" placeholder="O que esta automação fará?" />
          <label className="block"><span className="text-xs text-slate-400">Ação</span><select value={action} onChange={(event) => setAction(event.target.value as StaffAutomationAction)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white">{Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="grid md:grid-cols-2 gap-3">
            <label><span className="text-xs text-slate-400">Frequência</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as StaffAutomationFrequency)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"><option value="hourly">A cada algumas horas</option><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option></select></label>
            {frequency === 'hourly' ? <label><span className="text-xs text-slate-400">Intervalo em horas</span><input type="number" min={1} max={24} value={interval} onChange={(event) => setIntervalValue(Number(event.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label> : <label><span className="text-xs text-slate-400">Horário</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white" /></label>}
          </div>
          {frequency === 'weekly' && <label className="block"><span className="text-xs text-slate-400">Dia da semana</span><select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white"><option value={1}>Segunda</option><option value={2}>Terça</option><option value={3}>Quarta</option><option value={4}>Quinta</option><option value={5}>Sexta</option><option value={6}>Sábado</option><option value={0}>Domingo</option></select></label>}
          <button disabled={saving} className="w-full btn-purple py-3.5 rounded-xl font-bold flex items-center justify-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />} Criar automação</button>
        </div>
      </form>
    </div>
  )
}
