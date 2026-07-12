import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, MessageCircle, Send, Sparkles, Trash2 } from 'lucide-react'
import { clearMessages, saveMessage, type NewStaffTask, type StaffMessage, type StaffTask } from '@/lib/staffData'
import { parseStaffCommand } from '@/lib/staffParser'
import { cn, formatDateTime } from '@/lib/staffUi'

export function ChatView({ user, tasks, messages, setMessages, onTaskCreated, initialPrompt, onPromptConsumed }: {
  user: any
  tasks: StaffTask[]
  messages: StaffMessage[]
  setMessages: (messages: StaffMessage[]) => void
  onTaskCreated: (task: NewStaffTask) => Promise<StaffTask>
  initialPrompt: string
  onPromptConsumed: () => void
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => {
    if (!initialPrompt) return
    setInput(initialPrompt)
    onPromptConsumed()
  }, [initialPrompt, onPromptConsumed])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)
    const userMessage = await saveMessage(user.id, 'user', text)
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)

    try {
      const parsed = parseStaffCommand(text)
      if (parsed.kind === 'create_task') {
        const task = await onTaskCreated(parsed.task)
        const content = `Pronto. Criei “${task.title}”${task.due_at ? ` para ${formatDateTime(task.due_at).toLowerCase()}` : ''}. Você pode acompanhar e concluir na área Tarefas.`
        const assistant = await saveMessage(user.id, 'assistant', content)
        setMessages([...currentMessages, assistant])
        return
      }

      if (parsed.kind === 'list_tasks') {
        const pending = tasks.filter((task) => task.status === 'pending').slice(0, 8)
        const content = pending.length === 0
          ? 'Você não tem tarefas pendentes no momento.'
          : `Estas são suas próximas tarefas:\n\n${pending.map((task, index) => `${index + 1}. ${task.title} — ${formatDateTime(task.due_at)}`).join('\n')}`
        const assistant = await saveMessage(user.id, 'assistant', content)
        setMessages([...currentMessages, assistant])
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
        }),
      })
      const data = await response.json()
      const assistant = await saveMessage(user.id, 'assistant', data.response || 'Entendi. Como você gostaria que eu organizasse isso?')
      setMessages([...currentMessages, assistant])
    } catch {
      const assistant = await saveMessage(user.id, 'assistant', 'Tive um problema ao responder agora. Sua mensagem foi salva; tente novamente em instantes.')
      setMessages([...currentMessages, assistant])
    } finally {
      setLoading(false)
    }
  }

  async function clearChat() {
    await clearMessages(user.id)
    setMessages([])
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-145px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div><p className="text-purple-300 font-semibold">Conversa</p><h1 className="text-2xl font-black text-white">Seu Staff pessoal</h1></div>
        <button onClick={clearChat} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 glass-card p-4 md:p-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-4"><Sparkles className="w-8 h-8 text-purple-300" /></div>
            <h2 className="text-xl font-bold text-white">Como posso ajudar?</h2>
            <p className="text-slate-500 max-w-md mt-2">Peça um lembrete, organize seu dia ou converse sobre qualquer área da sua vida.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {['Me lembra de pagar a luz amanhã às 9h', 'Quais são minhas tarefas?', 'Ajude a organizar minha semana'].map((suggestion) => (
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
        <MessageCircle className="w-5 h-5 text-slate-600 self-center ml-2" />
        <input value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} className="flex-1 px-2 bg-transparent text-white outline-none min-w-0" placeholder="Converse naturalmente com o Staff..." />
        <button disabled={!input.trim() || loading} className="btn-purple w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-50"><Send className="w-5 h-5" /></button>
      </form>
    </div>
  )
}
