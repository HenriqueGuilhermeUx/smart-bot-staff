import { useState, useEffect, useRef } from 'react'
import {
  ArrowRight,
  CheckCircle,
  X,
  Menu,
  Shield,
  Lock,
  User,
  LogOut,
  MessageSquare,
  Send,
  Loader2,
  Bell,
  BellOff,
  Sparkles,
  Trash2,
  Settings,
  Plus,
  Calendar,
  Wallet,
  Heart,
  Briefcase,
  Lightbulb,
  Clock
} from 'lucide-react'
import {
  supabase,
  signUp,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  type StaffUser
} from '@/lib/supabase'
import { FEATURES, HOW_IT_WORKS_STEPS, BENEFITS, FAQ, TRUST_BADGES, STAFF_PRICE_FORMATTED } from '@/lib/constants'

// ===========================================
// HELPERS
// ===========================================
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ===========================================
// MODAL
// ===========================================
function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-md p-8 max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        {children}
      </div>
    </div>
  )
}

// ===========================================
// SMART BOT ICON
// ===========================================
function SmartBotIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#a855f7' }} />
          <stop offset="100%" style={{ stopColor: '#7e22ce' }} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="#050816" />
      <circle cx="50" cy="50" r="35" fill="url(#iconGrad)" opacity="0.3" />
      <path d="M50 20 L70 35 L70 55 L50 70 L30 55 L30 35 Z" fill="url(#iconGrad)" />
      <circle cx="50" cy="45" r="8" fill="#050816" />
      <path d="M42 55 Q50 65 58 55" stroke="#050816" strokeWidth="3" fill="none" />
    </svg>
  )
}

// ===========================================
// PUSH NOTIFICATION SERVICE
// ===========================================
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

// ===========================================
// CHAT COMPONENT
// ===========================================
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Quick suggestion chips
const SUGGESTION_CHIPS = [
  { id: 'agenda', icon: Calendar, label: 'Ver agenda', prompt: 'O que tenho na minha agenda hoje?' },
  { id: 'financas', icon: Wallet, label: 'Finanças', prompt: 'Me ajude com minhas finanças pessoais' },
  { id: 'saude', icon: Heart, label: 'Saúde', prompt: 'Lembretes de saúde e bem-estar' },
  { id: 'trabalho', icon: Briefcase, label: 'Trabalho', prompt: 'Organizar minhas tarefas do trabalho' },
  { id: 'lembrete', icon: Clock, label: 'Novo lembrete', prompt: 'Criar um novo lembrete' },
  { id: 'sugestao', icon: Lightbulb, label: 'Dica do dia', prompt: 'Me dê uma sugestão útil para hoje' }
]

// Get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function ChatInterface({ user, staffUser }: { user: any; staffUser: StaffUser | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check if first time user
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted')
    }
    // Load previous messages
    const saved = localStorage.getItem(`staff_messages_${user.id}`)

    if (saved) {
      const parsed = JSON.parse(saved)
      setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })))
    }
  }, [user.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleNotifications = async () => {
    const granted = await requestNotificationPermission()
    setNotificationsEnabled(granted)
    if (granted) {
      new Notification('Smart Bot Staff', {
        body: 'Notificações ativadas! Você será notificado sobre lembretes e novidades.',
        icon: '/icon-192.png'
      })
    }
  }

  const saveMessages = (newMessages: Message[]) => {
    localStorage.setItem(`staff_messages_${user.id}`, JSON.stringify(newMessages))
  }

  // Send message to AI
  const sendMessageToAI = async (messageText: string) => {
    setIsLoading(true)

    try {
      const response = await fetch('/.netlify/functions/staff-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: messageText,
          thread_id: staffUser?.thread_id
        })
      })

      const data = await response.json()

      // If there's an AI response, add it
      if (data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }
        const finalMessages = [...messages, assistantMessage]
        setMessages(finalMessages)
        saveMessages(finalMessages)

        if (notificationsEnabled && Notification.permission === 'granted') {
          new Notification('Smart Bot Staff', {
            body: data.response.substring(0, 100) + '...',
            icon: '/icon-192.png'
          })
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    saveMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/.netlify/functions/staff-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: userMessage.content,
          thread_id: staffUser?.thread_id
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Desculpe, tive um problema ao processar sua mensagem.',
        timestamp: new Date()
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      saveMessages(finalMessages)

      if (notificationsEnabled && Notification.permission === 'granted') {
        new Notification('Smart Bot Staff', {
          body: assistantMessage.content.substring(0, 100) + '...',
          icon: '/icon-192.png'
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.',
        timestamp: new Date()
      }
      const errorMessages = [...newMessages, errorMessage]
      setMessages(errorMessages)
      saveMessages(errorMessages)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChipClick = (prompt: string) => {
    setInput(prompt)
  }

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem(`staff_messages_${user.id}`)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Chat Header */}
      <div className="glass-card m-4 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SmartBotIcon className="w-10 h-10" />
          <div>
            <h2 className="font-bold text-white">Smart Bot Staff</h2>
            <p className="text-sm text-slate-400">{getGreeting()}, {user.user_metadata?.name || ' usuário'}!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleNotifications}
            className={cn(
              'p-2 rounded-lg transition-colors',
              notificationsEnabled
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            )}
            title={notificationsEnabled ? 'Notificações ativadas' : 'Ativar notificações'}
          >
            {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 transition-colors"
            title="Limpar conversa"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip.id}
            onClick={() => handleChipClick(chip.prompt)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 text-slate-300 hover:bg-purple-600/20 hover:text-purple-300 whitespace-nowrap transition-colors text-sm"
          >
            <chip.icon className="w-4 h-4" />
            {chip.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Como posso te ajudar hoje?</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Pergunte sobre finanças, saúde, trabalho, eventos ou qualquer outra coisa!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] p-4 rounded-lg',
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-200'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={cn(
                'text-xs mt-2',
                message.role === 'user' ? 'text-purple-200' : 'text-slate-500'
              )}>
                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-200 p-4 rounded-lg flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Digitando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4">
        <div className="glass-card p-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-transparent px-4 py-2 text-white placeholder-slate-400 outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-purple p-3 rounded-lg disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  )
}

// Bot categories with icons and descriptions
const BOTS = [
  { id: 'financas', name: 'Gestão Financeira', icon: '💰', color: 'green', description: 'Contas, orçamentos e investimentos' },
  { id: 'veiculos', name: 'Veículos & Docs', icon: '🚗', color: 'blue', description: 'Documentos, IPVA e manutenção' },
  { id: 'casa', name: 'Casa & Família', icon: '🏠', color: 'yellow', description: 'Lists, lembretes e planejamento' },
  { id: 'filhos', name: 'Filhos & Escola', icon: '👨‍👩‍👧', color: 'purple', description: 'Escola, materiais e atividades' },
  { id: 'saude', name: 'Saúde & Bem-estar', icon: '❤️', color: 'red', description: 'Médicos, remédios e exercícios' },
  { id: 'trabalho', name: 'Profissional', icon: '💼', color: 'cyan', description: 'Tarefas, prazos e produtividade' },
  { id: 'eventos', name: 'Eventos & Datas', icon: '🎉', color: 'pink', description: 'Aniversários, eventos e lembretes' },
  { id: 'investimentos', name: 'Investimentos', icon: '📈', color: 'emerald', description: 'Ações, crypto e portfólio' },
  { id: 'seguranca', name: 'Segurança', icon: '🔒', color: 'indigo', description: 'Senhas e dados protegidos' },
]

// Bot colors
const BOT_COLORS: Record<string, string> = {
  green: 'border-green-500/50 hover:bg-green-500/10',
  blue: 'border-blue-500/50 hover:bg-blue-500/10',
  yellow: 'border-yellow-500/50 hover:bg-yellow-500/10',
  purple: 'border-purple-500/50 hover:bg-purple-500/10',
  red: 'border-red-500/50 hover:bg-red-500/10',
  cyan: 'border-cyan-500/50 hover:bg-cyan-500/10',
  pink: 'border-pink-500/50 hover:bg-pink-500/10',
  emerald: 'border-emerald-500/50 hover:bg-emerald-500/10',
  indigo: 'border-indigo-500/50 hover:bg-indigo-500/10',
}

// ===========================================
// BOT GRID - Selection screen
// ===========================================
function BotsGrid({ user, onSelectBot, onLogout }: { user: any; onSelectBot: (botId: string) => void; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-dark pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <SmartBotIcon className="w-16 h-16" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white">
                {getGreeting()}, {user.user_metadata?.name || ' usuário'}!
              </h1>
              <p className="text-slate-400">Selecione uma área para começar a conversar</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {/* Bots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BOTS.map((bot) => (
            <button
              key={bot.id}
              onClick={() => onSelectBot(bot.id)}
              className={cn(
                'glass-card p-6 text-left transition-all duration-300',
                'border-2 border-transparent hover:scale-105',
                BOT_COLORS[bot.color] || 'border-purple-500/50 hover:bg-purple-500/10'
              )}
            >
              <div className="flex items-start gap-4">
                <span className="text-5xl">{bot.icon}</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{bot.name}</h3>
                  <p className="text-slate-400 text-sm">{bot.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end text-purple-400 text-sm">
                <span>Abrir</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===========================================
// CHAT COMPONENT - Per bot category
// ===========================================
function BotChatInterface({ user, botId, onBack }: { user: any; botId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const bot = BOTS.find(b => b.id === botId)
  const storageKey = `staff_${botId}_${user.id}`

  // Suggestion chips based on bot category
  const botSuggestions = getBotSuggestions(botId)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved)
      setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })))
    }
  }, [botId, user.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveMessages = (newMessages: Message[]) => {
    localStorage.setItem(storageKey, JSON.stringify(newMessages))
  }

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Check if input is a shortcut number
    let messageToSend = input.trim()
    if (['1', '2', '3', '4'].includes(input.trim())) {
      const shortcutPrompt = findSuggestionByShortcut(botId, input.trim())
      if (shortcutPrompt) {
        messageToSend = shortcutPrompt
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    saveMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/.netlify/functions/staff-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: `[${bot?.name}] ${userMessage.content}`,
          bot_category: botId
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Desculpe, tive um problema ao processar sua mensagem.',
        timestamp: new Date()
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      saveMessages(finalMessages)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.',
        timestamp: new Date()
      }
      setMessages([...newMessages, errorMessage])
      saveMessages([...newMessages, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem(storageKey)
  }

  return (
    <div className="flex flex-col h-screen bg-dark">
      {/* Header */}
      <div className="glass-card m-4 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white">
            <ArrowRight className="w-5 h-5 rotate-180" />
          </button>
          <span className="text-4xl">{bot?.icon}</span>
          <div>
            <h2 className="font-bold text-white">{bot?.name}</h2>
            <p className="text-sm text-slate-400">{bot?.description}</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 transition-colors"
          title="Limpar conversa"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Conversar com {bot?.name}</h3>
            <p className="text-slate-400 max-w-md mx-auto text-sm mb-4">
              Como posso te ajudar com {bot?.description?.toLowerCase()}?
            </p>
            {/* Suggestion Chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {botSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  className="px-4 py-2 rounded-full bg-slate-800/80 text-slate-300 hover:bg-purple-600/20 hover:text-purple-300 transition-colors text-sm"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] p-4 rounded-lg',
                message.role === 'user' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-200'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={cn('text-xs mt-2', message.role === 'user' ? 'text-purple-200' : 'text-slate-500')}>
                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-200 p-4 rounded-lg flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Digitando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4">
        <div className="glass-card p-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Pergunte sobre ${bot?.description?.toLowerCase()}...`}
            className="flex-1 bg-transparent px-4 py-2 text-white placeholder-slate-400 outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-purple p-3 rounded-lg disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  )
}

// Get suggestions based on bot category
function getBotSuggestions(botId: string) {
  const suggestions: Record<string, Array<{label: string, prompt: string, shortcut: string}>> = {
    financas: [
      { label: '1. Controle de gastos', prompt: 'Me ajude a controlar meus gastos mensais', shortcut: '1' },
      { label: '2. Organizar orçamento', prompt: 'Criar um orçamento para este mês', shortcut: '2' },
      { label: '3. Contas a pagar', prompt: 'Quais contas preciso pagar esta semana?', shortcut: '3' },
      { label: '4. Investimentos', prompt: 'Sugira como investir meu dinheiro', shortcut: '4' },
    ],
    veiculos: [
      { label: '1. IPVA', prompt: 'Quando vence o IPVA do meu carro?', shortcut: '1' },
      { label: '2. Manutenção', prompt: 'Quando foi a última revisão do meu veículo?', shortcut: '2' },
      { label: '3. Documentos', prompt: 'Quais documentos do carro preciso renovar?', shortcut: '3' },
      { label: '4. Combustível', prompt: 'Calcule o gasto médio de combustível', shortcut: '4' },
    ],
    casa: [
      { label: '1. Lista de compras', prompt: 'Criar lista de compras para esta semana', shortcut: '1' },
      { label: '2. Lembretes', prompt: 'Criar lembretes importantes para casa', shortcut: '2' },
      { label: '3. Planejamento', prompt: 'Planeje o cardápio da semana', shortcut: '3' },
      { label: '4. Serviços', prompt: 'Quando foi a última dedetização?', shortcut: '4' },
    ],
    filhos: [
      { label: '1. Escola', prompt: 'Organizar rotina escolar dos filhos', shortcut: '1' },
      { label: '2. Materiais', prompt: 'Lista de materiais escolares necessários', shortcut: '2' },
      { label: '3. Pediatra', prompt: 'Quando é a próxima consulta do Pediatra?', shortcut: '3' },
      { label: '4. Atividades', prompt: 'Agendar atividades extras das crianças', shortcut: '4' },
    ],
    saude: [
      { label: '1. Remédios', prompt: 'Criar lembretes para tomar remédios', shortcut: '1' },
      { label: '2. Exercícios', prompt: 'Criar rotina de exercícios semanais', shortcut: '2' },
      { label: '3. Consultas', prompt: 'Agendar exames de rotina', shortcut: '3' },
      { label: '4. Alimentação', prompt: 'Sugira um cardápio saudável', shortcut: '4' },
    ],
    trabalho: [
      { label: '1. Tarefas', prompt: 'Liste minhas tarefas prioritárias de hoje', shortcut: '1' },
      { label: '2. Prazos', prompt: 'Quais projetos têm prazos próximos?', shortcut: '2' },
      { label: '3. Produtividade', prompt: 'Dicas para aumentar minha produtividade', shortcut: '3' },
      { label: '4. E-mails', prompt: 'Resumir e-mails importantes', shortcut: '4' },
    ],
    eventos: [
      { label: '1. Aniversários', prompt: 'Quem faz aniversário este mês?', shortcut: '1' },
      { label: '2. Festas', prompt: 'Planejar uma festa de aniversário', shortcut: '2' },
      { label: '3. Lembretes', prompt: 'Criar lembretes para eventos importantes', shortcut: '3' },
      { label: '4. Lista', prompt: 'Criar lista de convidados', shortcut: '4' },
    ],
    investimentos: [
      { label: '1. Carteira', prompt: 'Como está minha carteira de investimentos?', shortcut: '1' },
      { label: '2. Alertas', prompt: 'Configurar alertas de mercado', shortcut: '2' },
      { label: '3. Imóveis', prompt: 'Analisar investimento em imóveis', shortcut: '3' },
      { label: '4. Diversificação', prompt: 'Sugira como diversificar meus investimentos', shortcut: '4' },
    ],
    seguranca: [
      { label: '1. Senhas', prompt: 'Criar senhas seguras para minhas contas', shortcut: '1' },
      { label: '2. Backup', prompt: 'Como fazer backup dos meus dados?', shortcut: '2' },
      { label: '3. Privacidade', prompt: 'Dicas para proteger minha privacidade online', shortcut: '3' },
      { label: '4. Celular', prompt: 'Verificar segurança do meu celular', shortcut: '4' },
    ],
  }
  return suggestions[botId] || [
    { label: '1. Como posso ajudar?', prompt: 'O que você precisa organizar?', shortcut: '1' },
    { label: '2. Meus lembretes', prompt: 'Mostre meus lembretes pendentes', shortcut: '2' },
    { label: '3. Dica do dia', prompt: 'Me dê uma sugestão útil para hoje', shortcut: '3' },
  ]
}

// Find suggestion by shortcut number
function findSuggestionByShortcut(botId: string, shortcut: string): string | null {
  const suggestions = getBotSuggestions(botId)
  const found = suggestions.find(s => s.shortcut === shortcut)
  return found ? found.prompt : null
}

// ===========================================
// DASHBOARD
// ===========================================
function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [activeBot, setActiveBot] = useState<string | null>(null)

  if (activeBot) {
    return <BotChatInterface user={user} botId={activeBot} onBack={() => setActiveBot(null)} />
  }

  return <BotsGrid user={user} onSelectBot={setActiveBot} onLogout={onLogout} />
}

// ===========================================
// LANDING PAGE COMPONENTS
// ===========================================
function Header({ user, onLoginClick, onLogout, onDashboard }: {
  user: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onDashboard: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 w-full z-50 glass-card !rounded-none border-b border-t-0 border-x-0">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <a href="#" className="text-2xl font-black text-white flex items-center gap-2">
          <SmartBotIcon />
          <span>Smart<span className="text-purple-400">Bot</span></span>
        </a>

        <nav className="hidden md:flex items-center space-x-6 text-sm">
          <a href="#features" className="hover:text-purple-400 transition-colors">Funcionalidades</a>
          <a href="#how-it-works" className="hover:text-purple-400 transition-colors">Como Funciona</a>
          <a href="#signup" className="hover:text-purple-400 transition-colors">Começar</a>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <button
                onClick={onDashboard}
                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Chat com Staff
              </button>
              <button
                onClick={onLogout}
                className="bg-slate-700/50 hover:bg-slate-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Entrar / Cadastrar
            </button>
          )}
        </div>

        <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800">
          <nav className="flex flex-col p-4 space-y-4">
            <a href="#features" className="hover:text-purple-400 transition-colors">Funcionalidades</a>
            <a href="#how-it-works" className="hover:text-purple-400 transition-colors">Como Funciona</a>
            <a href="#signup" className="hover:text-purple-400 transition-colors">Começar</a>
            {user ? (
              <>
                <button onClick={onDashboard} className="bg-purple-600 text-white font-medium py-2 px-4 rounded-lg">
                  Chat com Staff
                </button>
                <button onClick={onLogout} className="bg-slate-700 text-white font-medium py-2 px-4 rounded-lg">
                  Sair
                </button>
              </>
            ) : (
              <button onClick={onLoginClick} className="bg-purple-600 text-white font-medium py-2 px-4 rounded-lg">
                Entrar / Cadastrar
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center text-center overflow-hidden pt-20">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] max-w-4xl max-h-4xl bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 z-10">
        <div className="inline-block bg-purple-500/20 text-purple-300 text-sm font-bold px-4 py-2 rounded-full mb-6 border border-purple-500/30">
          O Melhor Assistente Pessoal de IA do Brasil
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-gray-100 leading-tight mb-6">
          "Tá enrolado?<br />
          Deixa o seu <span className="text-purple-400">STAFF</span> te ajudar!"
        </h1>

        <p className="text-lg md:text-xl lg:text-2xl text-slate-400 mb-10 max-w-3xl mx-auto">
          Seu assistente pessoal de IA que organiza <strong className="text-white">toda sua vida</strong> via chat.
          Finanças, família, casa, saúde, investimentos... tudo em um só lugar.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-purple font-bold text-lg text-white py-4 px-10 rounded-full glow-effect-purple flex items-center gap-2"
          >
            Começar Agora - É Grátis!
            <ArrowRight className="w-5 h-5" />
          </button>
          <a href="#how-it-works" className="bg-slate-700/50 hover:bg-slate-600/50 font-bold text-lg text-white py-4 px-10 rounded-full transition-colors">
            Ver Como Funciona
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-sm text-slate-400 mt-6">
          {TRUST_BADGES.map((badge, index) => (
            <span key={index} className="flex items-center gap-2">{badge}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-gradient-to-b from-transparent to-slate-900/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-100 mb-4">
            Funcionalidades Completas
          </h2>
          <p className="text-lg md:text-xl text-slate-400">
            O Staff cuida de <strong className="text-white">tudo</strong> que você precisa. Sério, tudo mesmo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div key={feature.id} className="glass-card p-6 feature-card">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{feature.icon}</span>
                <h3 className="text-xl font-bold text-gray-100">{feature.title}</h3>
              </div>
              <ul className="text-slate-300 space-y-2 text-sm">
                {feature.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-100 mb-4">
            Como Funciona
          </h2>
          <p className="text-lg md:text-xl text-slate-400">
            Simples, rápido e intuitivo. Você vai se surpreender.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 glow-effect-purple">
                <span className="text-4xl">{item.icon}</span>
              </div>
              <div className="text-2xl font-black text-purple-400 mb-2">{item.step}</div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">{item.title}</h3>
              <p className="text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <section id="signup" className="py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-100 mb-4">
            100% Gratuito
          </h2>
          <p className="text-lg md:text-xl text-slate-400">
            Sem limites, sem cobranças, sem pegadinhas.
          </p>
        </div>

        <div className="glass-card p-8 md:p-12 max-w-2xl mx-auto text-center border-2 border-green-500 glow-effect-purple">
          <div className="inline-block bg-green-500/20 text-green-300 text-sm font-bold px-4 py-2 rounded-full mb-6 border border-green-500/30">
            ✨ Totalmente Gratuito
          </div>

          <h3 className="text-2xl md:text-3xl font-bold text-gray-100 mb-4">Plano Staff</h3>

          <div className="flex items-baseline justify-center gap-2 mb-6">
            <span className="text-5xl md:text-6xl font-black text-green-400">GRÁTIS</span>
          </div>

          <ul className="text-left text-slate-300 space-y-3 mb-8 max-w-md mx-auto">
            <li className="flex items-center gap-3">
              <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
              <span><strong className="text-white">Chat ilimitado</strong> com o Staff</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
              <span>Todas as funcionalidades de organização</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
              <span>Lembretes inteligentes</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
              <span>Notificações push</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
              <span>PWA - Instale no celular</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="text-green-400 w-5 h-5 flex-shrink-0" />
              <span>Sem compromisso - use para sempre</span>
            </li>
          </ul>

          <button
            onClick={onLoginClick}
            className="w-full btn-purple font-bold text-xl text-white py-4 rounded-lg mb-4"
          >
            Criar Conta Grátis Agora
          </button>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Autenticação segura
            </span>
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações push
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function BenefitsSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-transparent to-slate-900/30">
      <div className="container mx-auto px-6">
        <div className="glass-card p-8 md:p-12 max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-100 mb-8">
            Por Que o Staff é Diferente?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {BENEFITS.map((benefit, index) => (
              <div key={index}>
                <div className="text-5xl mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-bold text-gray-100 mb-2">{benefit.title}</h3>
                <p className="text-slate-300">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-100 mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg md:text-xl text-slate-400">
            Tire suas dúvidas sobre o Smart Bot
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {FAQ.map((item, index) => (
            <div key={index} className="glass-card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full text-left p-6 flex justify-between items-center"
              >
                <span className="font-semibold text-gray-100">{item.question}</span>
                <span className={`text-purple-400 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6 text-slate-300">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <section className="py-24">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-100 mb-6">
          Pronto para Organizar sua Vida?
        </h2>
        <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Junte-se a milhares de brasileiros que já estão usando o Staff para ter mais tempo,
          menos estresse e controle total da vida.
        </p>
        <button
          onClick={onLoginClick}
          className="btn-purple font-bold text-xl text-white py-4 px-12 rounded-full glow-effect-purple inline-flex items-center gap-2"
        >
          Criar Conta Grátis
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 border-t border-slate-800">
      <div className="container mx-auto px-6 text-center text-slate-400">
        <div className="flex items-center justify-center gap-2 mb-4">
          <SmartBotIcon />
          <span className="text-xl font-bold text-white">Smart<span className="text-purple-400">Bot</span></span>
        </div>
        <p>&copy; 2025 Smart Bot - Seu Staff Pessoal. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

// ===========================================
// AUTH FORMS
// ===========================================
function LoginForm({ onSwitchToSignup, onClose, onSuccess }: { onSwitchToSignup: () => void; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      await signIn(formData.email, formData.password)
      onSuccess()
    } catch (error: any) {
      console.error('Erro no login:', error)
      setErrorMessage(error.message || 'Email ou senha incorretos')
      setStatus('error')
    }
  }

  return (
    <>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-100">Entrar na sua Conta</h2>
        <p className="text-slate-400 text-sm mt-2">Acesse sua conta Smart Bot</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">E-mail</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">Senha</label>
          <input
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
            placeholder="Sua senha"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full btn-purple font-bold text-white py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Entrando...</>
          ) : (
            <><LogOut className="w-5 h-5" /> Entrar</>
          )}
        </button>

        {status === 'error' && (
          <p className="text-red-400 text-sm text-center">{errorMessage}</p>
        )}
      </form>

      <div className="mt-6 text-center">
        <p className="text-slate-400 text-sm">
          Não tem conta?{' '}
          <button onClick={onSwitchToSignup} className="text-purple-400 hover:text-purple-300 font-medium">
            Cadastre-se
          </button>
        </p>
      </div>
    </>
  )
}

function SignupForm({ onSwitchToLogin, onSuccess }: { onSwitchToLogin: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('As senhas não coincidem')
      setStatus('error')
      return
    }

    if (formData.password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres')
      setStatus('error')
      return
    }

    setStatus('loading')

    try {
      await signUp(formData.email, formData.password, formData.name, '')
      setStatus('success')
    } catch (error: any) {
      console.error('Erro no cadastro:', error)
      setErrorMessage(error.message || 'Erro ao criar conta')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-green-400 mb-4">Conta Criada!</h3>
        <p className="text-slate-300 mb-6">
          Verifique seu e-mail para confirmar sua conta.
        </p>
        <p className="text-slate-400 text-sm mb-6">
          Após confirmar, você poderá fazer login e acessar o Staff.
        </p>
        <button
          onClick={onSuccess}
          className="btn-purple font-bold text-white py-3 px-6 rounded-lg"
        >
          Ir para o Chat
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Plus className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-100">Criar Conta</h2>
        <p className="text-slate-400 text-sm mt-2">Cadastre-se no Smart Bot</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">Nome Completo</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
            placeholder="Seu nome completo"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">E-mail</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">Senha</label>
          <input
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-1">Confirmar Senha</label>
          <input
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
            placeholder="Repita a senha"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full btn-purple font-bold text-white py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Criando conta...</>
          ) : (
            <><Plus className="w-5 h-5" /> Criar Conta</>
          )}
        </button>

        {status === 'error' && (
          <p className="text-red-400 text-sm text-center">{errorMessage}</p>
        )}
      </form>

      <div className="mt-6 text-center">
        <p className="text-slate-400 text-sm">
          Já tem conta?{' '}
          <button onClick={onSwitchToLogin} className="text-purple-400 hover:text-purple-300 font-medium">
            Fazer login
          </button>
        </p>
      </div>
    </>
  )
}

// ===========================================
// MAIN APP
// ===========================================
export default function App() {
  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup')
  const [showDashboard, setShowDashboard] = useState(false)

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    setShowDashboard(true)
    setUser(supabase.auth.currentUser)
  }

  // Redirect logged in users to dashboard immediately
  useEffect(() => {
    getSession().then(session => {
      if (session?.user) {
        setUser(session.user)
        setShowDashboard(true)
      }
    })

    const { data: { subscription } } = onAuthStateChange((user) => {
      if (user) {
        setUser(user)
        setShowDashboard(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLoginClick = () => {
    setAuthMode('login')
    setShowAuthModal(true)
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    setShowDashboard(false)
  }

  const handleSwitchToLogin = () => setAuthMode('login')
  const handleSwitchToSignup = () => setAuthMode('signup')

  // Show dashboard if user is logged in
  if (user && showDashboard) {
    return (
      <div className="min-h-screen bg-dark">
        <button
          onClick={() => setShowDashboard(false)}
          className="fixed top-4 left-4 z-50 glass-card p-2 rounded-lg hover:bg-slate-800"
        >
          <ArrowRight className="w-5 h-5 text-white rotate-180" />
        </button>
        <Dashboard user={user} onLogout={handleLogout} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark">
      <Header
        user={user}
        onLoginClick={handleLoginClick}
        onLogout={handleLogout}
        onDashboard={() => setShowDashboard(true)}
      />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection onLoginClick={handleLoginClick} />
      <BenefitsSection />
      <FAQSection />
      <CTASection onLoginClick={handleLoginClick} />
      <Footer />

      <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)}>
        {authMode === 'login' ? (
          <LoginForm onSwitchToSignup={handleSwitchToSignup} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
        ) : (
          <SignupForm onSwitchToLogin={handleSwitchToLogin} onSuccess={handleAuthSuccess} />
        )}
      </Modal>
    </div>
  )
}