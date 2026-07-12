import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellOff,
  Home,
  LayoutGrid,
  ListTodo,
  Loader2,
  Menu,
  MessageCircle,
  Settings,
} from 'lucide-react'
import {
  createTask,
  deleteTask,
  loadMessages,
  loadTasks,
  updateTask,
  type NewStaffTask,
  type StaffMessage,
  type StaffTask,
} from '@/lib/staffData'
import { cn, type StaffScreen } from '@/lib/staffUi'
import { StaffLogo } from '@/components/staff/Brand'
import { AddTaskModal, TasksView, TodayView } from '@/components/staff/TaskViews'
import { ChatView } from '@/components/staff/ChatView'
import { LifeView, SettingsView } from '@/components/staff/LifeSettings'

export function StaffWorkspace({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [screen, setScreen] = useState<StaffScreen>('today')
  const [tasks, setTasks] = useState<StaffTask[]>([])
  const [messages, setMessages] = useState<StaffMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [pendingChatPrompt, setPendingChatPrompt] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const nexaConnected = Boolean(localStorage.getItem('nexaToken'))

  useEffect(() => {
    let mounted = true
    Promise.all([loadTasks(user.id), loadMessages(user.id)]).then(([taskData, messageData]) => {
      if (!mounted) return
      setTasks(taskData)
      setMessages(messageData)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [user.id])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!notificationsEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const now = Date.now()
      tasks
        .filter((task) => task.status === 'pending' && (task.remind_at || task.due_at))
        .forEach((task) => {
          const due = new Date((task.remind_at || task.due_at) as string).getTime()
          const key = `staff_notified_${task.id}`
          if (due <= now && now - due < 24 * 60 * 60 * 1000 && !localStorage.getItem(key)) {
            new Notification('Staff', { body: task.title, icon: '/icon-192.png' })
            localStorage.setItem(key, new Date().toISOString())
          }
        })
    }, 30000)
    return () => window.clearInterval(interval)
  }, [tasks, notificationsEnabled])

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
    if (!a.due_at && !b.due_at) return b.created_at.localeCompare(a.created_at)
    if (!a.due_at) return 1
    if (!b.due_at) return -1
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  }), [tasks])

  async function handleCreate(input: NewStaffTask) {
    const task = await createTask(user.id, input)
    setTasks((current) => [task, ...current])
    return task
  }

  async function handleToggle(task: StaffTask) {
    const updated = await updateTask(user.id, task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })
    if (updated) setTasks((current) => current.map((item) => item.id === task.id ? updated : item))
  }

  async function handleDelete(task: StaffTask) {
    await deleteTask(user.id, task.id)
    setTasks((current) => current.filter((item) => item.id !== task.id))
  }

  async function toggleNotifications() {
    if (typeof Notification === 'undefined') return
    const permission = await Notification.requestPermission()
    setNotificationsEnabled(permission === 'granted')
    if (permission === 'granted') {
      new Notification('Staff', { body: 'Notificações ativadas com sucesso.', icon: '/icon-192.png' })
    }
  }

  function openLifeChat(prompt: string) {
    setPendingChatPrompt(prompt)
    setScreen('chat')
  }

  const nav = [
    { id: 'today' as StaffScreen, label: 'Hoje', icon: Home },
    { id: 'chat' as StaffScreen, label: 'Conversar', icon: MessageCircle },
    { id: 'tasks' as StaffScreen, label: 'Tarefas', icon: ListTodo },
    { id: 'life' as StaffScreen, label: 'Vida', icon: LayoutGrid },
    { id: 'settings' as StaffScreen, label: 'Ajustes', icon: Settings },
  ]

  if (loading) {
    return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="text-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" /><p className="text-slate-500 mt-3">Organizando seu Staff...</p></div></div>
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <header className="fixed top-0 inset-x-0 z-40 bg-[#050816]/90 backdrop-blur-xl border-b border-slate-800/70 safe-area-top">
        <div className="h-16 px-4 md:px-6 flex items-center justify-between">
          <StaffLogo compact />
          <div className="flex items-center gap-2">
            <button onClick={toggleNotifications} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-300">
              {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800"><Menu className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <aside className={cn(
        'fixed z-30 top-16 bottom-0 left-0 w-64 bg-[#070b1a]/95 backdrop-blur-xl border-r border-slate-800 p-4 transition-transform md:translate-x-0',
        menuOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 mb-5">
          <p className="text-xs text-slate-500">Seu Staff</p>
          <p className="font-bold text-white mt-1">{user.user_metadata?.name || user.email}</p>
          <p className="text-xs text-purple-300 mt-1">Plano gratuito</p>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <button key={item.id} onClick={() => { setScreen(item.id); setMenuOpen(false) }} className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
              screen === item.id
                ? 'bg-purple-500/15 text-purple-200 border border-purple-500/20'
                : 'text-slate-500 hover:bg-slate-900 hover:text-white border border-transparent',
            )}>
              <item.icon className="w-5 h-5" /><span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <p className="text-xs font-semibold text-purple-200">Staff independente</p>
          <p className="text-[11px] text-slate-500 mt-1">Nexa é uma integração opcional.</p>
        </div>
      </aside>

      {menuOpen && <button onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/60 md:hidden" />}

      <main className="pt-20 pb-24 md:pb-8 md:pl-64 min-h-screen">
        <div className="p-4 md:p-7">
          {screen === 'today' && <TodayView user={user} tasks={sortedTasks} onCreate={handleCreate} onToggle={handleToggle} onDelete={handleDelete} onNavigate={setScreen} />}
          {screen === 'tasks' && <TasksView tasks={sortedTasks} onCreateClick={() => setShowAddTask(true)} onToggle={handleToggle} onDelete={handleDelete} />}
          {screen === 'chat' && <ChatView user={user} tasks={sortedTasks} messages={messages} setMessages={setMessages} onTaskCreated={handleCreate} initialPrompt={pendingChatPrompt} onPromptConsumed={() => setPendingChatPrompt('')} />}
          {screen === 'life' && <LifeView onOpenChat={openLifeChat} />}
          {screen === 'settings' && <SettingsView notificationsEnabled={notificationsEnabled} onNotifications={toggleNotifications} onLogout={onLogout} nexaConnected={nexaConnected} />}
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#070b1a]/95 backdrop-blur-xl border-t border-slate-800 safe-area-bottom">
        <div className="grid grid-cols-5 px-2 py-2">
          {nav.map((item) => (
            <button key={item.id} onClick={() => setScreen(item.id)} className={cn('flex flex-col items-center gap-1 py-1 text-[10px]', screen === item.id ? 'text-purple-300' : 'text-slate-600')}>
              <item.icon className="w-5 h-5" />{item.label}
            </button>
          ))}
        </div>
      </nav>

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onCreate={async (task) => { await handleCreate(task) }} />}
    </div>
  )
}
