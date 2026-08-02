import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, MessageCircle, Send, Sparkles, Trash2 } from 'lucide-react'
import { clearMessages, saveMessage, type NewStaffTask, type StaffMessage, type StaffTask } from '@/lib/staffData'
import type { NewStaffEvent, StaffEvent } from '@/lib/staffCalendarData'
import type { NewStaffAutomation, StaffAutomation } from '@/lib/staffAutomationData'
import { parseStaffCommand } from '@/lib/staffParser'
import { cn, formatDateTime, type StaffScreen } from '@/lib/staffUi'
import { speakStaffResponse } from '@/lib/staffVoice'
import { VoiceButton } from '@/components/staff/VoiceButton'

function normalizeCommand(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function sameDay(value: string | Date, target: Date) {
  return new Date(value).toDateString() === target.toDateString()
}

function navigationFromCommand(text: string): StaffScreen | null {
  const value = normalizeCommand(text)
  const wantsNavigation = /^(abra|abrir|mostre|mostrar|va para|ir para|quero ver|acesse|acessar)/.test(value)
  if (!wantsNavigation) return null
  if (/(agenda|calendario|compromissos)/.test(value)) return 'calendar'
  if (/(tarefas|lembretes|pendencias)/.test(value)) return 'tasks'
  if (/(automacoes|rotinas automaticas)/.test(value)) return 'automations'
  if (/(ajustes|configuracoes|preferencias)/.test(value)) return 'settings'
  if (/(areas da vida|vida)/.test(value)) return 'life'
  if (/(inicio|hoje|painel)/.test(value)) return 'today'
  if (/(conversa|chat|conversar)/.test(value)) return 'chat'
  return null
}

function navigationLabel(screen: StaffScreen) {
  const labels: Partial<Record<StaffScreen, string>> = {
    today: 'Hoje',
    calendar: 'Agenda',
    chat: 'Conversar',
    tasks: 'Tarefas',
    life: 'Áreas da vida',
    automations: 'Automações',
    settings: 'Configurações',
  }
  return labels[screen] || 'área solicitada'
}

export function ChatView({
  user,
  tasks,
  events,
  automations,
  messages,
  setMessages,
  onTaskCreated,
  onEventCreated,
  onAutomationCreated,
  onNavigate,
  initialPrompt,
  autoSubmitInitialPrompt = false,
  onPromptConsumed,
}: {
  user: any
  tasks: StaffTask[]
  events: StaffEvent[]
  automations: StaffAutomation[]
  messages: StaffMessage[]
  setMessages: (messages: StaffMessage[]) => void
  onTaskCreated: (task: NewStaffTask) => Promise<StaffTask>
  onEventCreated: (event: NewStaffEvent) => Promise<StaffEvent[]>
  onAutomationCreated: (automation: NewStaffAutomation) => Promise<StaffAutomation>
  onNavigate: (screen: StaffScreen) => void
  initialPrompt: string
  autoSubmitInitialPrompt?: boolean
  onPromptConsumed: () => void
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => {
    if (!initialPrompt) return
    const prompt = initialPrompt
    onPromptConsumed()
    if (autoSubmitInitialPrompt) void processText(prompt, true)
    else setInput(prompt)
  }, [initialPrompt, autoSubmitInitialPrompt, onPromptConsumed])

  async function answer(currentMessages: StaffMessage[], content: string, fromVoice: boolean) {
    const assistant = await saveMessage(user.id, 'assistant', content)
    setMessages([...currentMessages, assistant])
    void speakStaffResponse(content, fromVoice)
  }

  async function processText(textValue: string, fromVoice = false) {
    const text = textValue.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)
    const userMessage = await saveMessage(user.id, 'user', text)
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)

    try {
      const normalized = normalizeCommand(text)
      const navigation = navigationFromCommand(text)

      if (navigation) {
        const content = `Abrindo ${navigationLabel(navigation)}.`
        await answer(currentMessages, content, fromVoice)
        onNavigate(navigation)
        return
      }

      if (/(o que eu tenho hoje|o que tenho hoje|resumo do meu dia|resumo do dia|como esta meu dia|como esta o meu dia)/.test(normalized)) {
        const today = new Date()
        const todayEvents = events
          .filter((item) => item.status === 'scheduled' && sameDay(item.start_at, today))
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
        const todayTasks = tasks
          .filter((task) => task.status === 'pending' && task.due_at && sameDay(task.due_at, today))
          .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
        const overdue = tasks.filter((task) => task.status === 'pending' && task.due_at && new Date(task.due_at).getTime() < today.getTime() && !sameDay(task.due_at, today))

        const sections = [
          todayEvents.length
            ? `Compromissos de hoje:\n${todayEvents.map((item, index) => `${index + 1}. ${item.title} — ${formatDateTime(item.start_at)}`).join('\n')}`
            : 'Você não tem compromissos marcados para hoje.',
          todayTasks.length
            ? `Tarefas de hoje:\n${todayTasks.map((task, index) => `${index + 1}. ${task.title} — ${formatDateTime(task.due_at)}`).join('\n')}`
            : 'Você não tem tarefas com prazo para hoje.',
          overdue.length ? `Atenção: ${overdue.length} tarefa${overdue.length === 1 ? ' está atrasada' : 's estão atrasadas'}.` : 'Não há tarefas atrasadas.',
        ]
        await answer(currentMessages, sections.join('\n\n'), fromVoice)
        return
      }

      const parsed = parseStaffCommand(text)

      if (parsed.kind === 'create_event') {
        const created = await onEventCreated(parsed.event)
        const first = created[0]
        const recurrenceNote = created.length > 1 ? ` Também criei ${created.length - 1} ocorrência(s) recorrente(s).` : ''
        await answer(currentMessages, `Pronto. Agendei “${first.title}” para ${formatDateTime(first.start_at).toLowerCase()}.${recurrenceNote} O compromisso já está na Agenda.`, fromVoice)
        return
      }

      if (parsed.kind === 'list_events') {
        const target = normalized.includes('amanha')
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : normalized.includes('hoje') ? new Date() : null
        const upcoming = events
          .filter((item) => item.status === 'scheduled' && new Date(item.end_at).getTime() >= Date.now())
          .filter((item) => !target || sameDay(item.start_at, target))
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
          .slice(0, 8)
        const content = upcoming.length === 0
          ? target ? `Sua agenda não tem compromissos para ${normalized.includes('amanha') ? 'amanhã' : 'hoje'}.` : 'Sua agenda não tem compromissos futuros no momento.'
          : `Estes são seus próximos compromissos:\n\n${upcoming.map((item, index) => `${index + 1}. ${item.title} — ${formatDateTime(item.start_at)}${item.location ? ` — ${item.location}` : ''}`).join('\n')}`
        await answer(currentMessages, content, fromVoice)
        return
      }

      if (parsed.kind === 'create_automation') {
        const automation = await onAutomationCreated(parsed.automation)
        await answer(currentMessages, `Automação criada: “${automation.name}”. Ela está ${automation.enabled ? 'ativa' : 'desativada'} e pode ser gerenciada em Mais, Automações.`, fromVoice)
        return
      }

      if (parsed.kind === 'list_automations') {
        const active = automations.filter((automation) => automation.enabled)
        const content = active.length === 0
          ? 'Você não tem automações ativas no momento.'
          : `Automações ativas:\n\n${active.map((automation, index) => `${index + 1}. ${automation.name} — próxima execução em ${formatDateTime(automation.next_run_at)}`).join('\n')}`
        await answer(currentMessages, content, fromVoice)
        return
      }

      if (parsed.kind === 'create_task') {
        const task = await onTaskCreated(parsed.task)
        await answer(currentMessages, `Pronto. Criei “${task.title}”${task.due_at ? ` para ${formatDateTime(task.due_at).toLowerCase()}` : ''}. Você pode acompanhar e concluir na área Tarefas.`, fromVoice)
        return
      }

      if (parsed.kind === 'list_tasks') {
        const pending = tasks.filter((task) => task.status === 'pending').slice(0, 8)
        const content = pending.length === 0
          ? 'Você não tem tarefas pendentes no momento.'
          : `Estas são suas próximas tarefas:\n\n${pending.map((task, index) => `${index + 1}. ${task.title} — ${formatDateTime(task.due_at)}`).join('\n')}`
        await answer(currentMessages, content, fromVoice)
        return
      }

      const response = await fetch('/.netlify/functions/staff-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: text,
          thread_id: 'main',
          nexaToken: localStorage.getItem('nexaToken') || '',
          context: {
            pending_tasks: tasks.filter((task) => task.status === 'pending').slice(0, 12),
            upcoming_events: events.filter((item) => item.status === 'scheduled' && new Date(item.start_at) >= new Date()).slice(0, 12),
            active_automations: automations.filter((item) => item.enabled).map((item) => item.name),
          },
        }),
      })
      const data = await response.json()
      await answer(currentMessages, data.response || 'Entendi. Como você gostaria que eu organizasse isso?', fromVoice)
    } catch {
      await answer(currentMessages, 'Tive um problema ao responder agora. Sua mensagem foi salva; tente novamente em instantes.', fromVoice)
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    await processText(input, false)
  }

  async function clearChat() {
    await clearMessages(user.id)
    setMessages([])
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-145px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div><p className="text-purple-300 font-semibold">Conversa por texto ou voz</p><h1 className="text-2xl font-black text-white">Seu Staff pessoal</h1></div>
        <button onClick={clearChat} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 glass-card p-4 md:p-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-4"><Sparkles className="w-8 h-8 text-purple-300" /></div>
            <h2 className="text-xl font-bold text-white">Como posso ajudar?</h2>
            <p className="text-slate-500 max-w-md mt-2">Fale ou digite para criar compromissos, tarefas, automações e consultar seu dia.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {[
                'Agende reunião amanhã às 10h e me avise 30 minutos antes',
                'Crie um resumo diário às 7h',
                'O que eu tenho hoje?',
              ].map((suggestion) => (
                <button key={suggestion} onClick={() => setInput(suggestion)} className="px-3 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm text-slate-400 hover:text-purple-200">{suggestion}</button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[86%] md:max-w-[72%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-md',
              )}>
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                <p className="text-[10px] mt-2 opacity-50">{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Pensando...</div></div>}
          <div ref={endRef} />
        </div>
      </div>
      <form onSubmit={submit} className="mt-3 glass-card p-2 flex gap-2">
        <MessageCircle className="w-5 h-5 text-slate-600 self-center ml-2 hidden sm:block" />
        <input value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} className="flex-1 px-2 bg-transparent text-white outline-none min-w-0" placeholder="Fale ou digite: Agende consulta amanhã às 14h..." />
        <VoiceButton disabled={loading} onTranscript={(text) => processText(text, true)} />
        <button disabled={!input.trim() || loading} className="btn-purple w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-50"><Send className="w-5 h-5" /></button>
      </form>
    </div>
  )
}
