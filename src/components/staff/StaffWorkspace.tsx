import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellOff,
  CalendarDays,
  Home,
  LayoutGrid,
  ListTodo,
  Loader2,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Zap,
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
import {
  createEvent,
  deleteEvent,
  loadEvents,
  updateEvent,
  type NewStaffEvent,
  type StaffEvent,
} from '@/lib/staffCalendarData'
import {
  createAutomation,
  deleteAutomation,
  loadAutomations,
  loadNotifications,
  markNotificationRead,
  toggleAutomation,
  type NewStaffAutomation,
  type StaffAutomation,
  type StaffNotificationItem,
} from '@/lib/staffAutomationData'
import {
  cancelEventNotifications,
  cancelTaskNotification,
  notificationsAreEnabled,
  requestStaffNotificationPermission,
  scheduleEventNotifications,
  scheduleTaskNotification,
  showNotificationTest,
  synchronizeEventNotifications,
  synchronizeTaskNotifications,
  usesNativeNotifications,
} from '@/lib/staffNotifications'
import { cn, type StaffScreen } from '@/lib/staffUi'
import { StaffLogo } from '@/components/staff/Brand'
import { AddTaskModal, TasksView, TodayView } from '@/components/staff/TaskViews'
import { ChatView } from '@/components/staff/ChatView'
import { LifeView, SettingsView } from '@/components/staff/LifeSettings'
import { AgendaView } from '@/components/staff/AgendaView'
import { AutomationsView } from '@/components/staff/AutomationsView'
import { MoreView } from '@/components/staff/MoreView'

export function StaffWorkspace({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [screen, setScreen] = useState<StaffScreen>('today')
  const [tasks, setTasks] = useState<StaffTask[]>([])
  const [events, setEvents] = useState<StaffEvent[]>([])
  const [automations, setAutomations] = useState<StaffAutomation[]>([])
  const [notifications, setNotifications] = useState<StaffNotificationItem[]>([])
  const [messages, setMessages] = useState<StaffMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [pendingChatPrompt, setPendingChatPrompt] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const nexaConnected = Boolean(localStorage.getItem('nexaToken'))

  useEffect(() => {
    let mounted = true

    async function loadWorkspace() {
      try {
        const [taskData, eventData, automationData, notificationData, messageData] = await Promise.all([
          loadTasks(user.id),
          loadEvents(user.id),
          loadAutomations(user.id),
          loadNotifications(user.id),
          loadMessages(user.id),
        ])

        if (!mounted) return
        setTasks(taskData)
        setEvents(eventData)
        setAutomations(automationData)
        setNotifications(notificationData)
        setMessages(messageData)

        const enabled = await notificationsAreEnabled()
        if (!mounted) return
        setNotificationsEnabled(enabled)

        if (enabled) {
          await Promise.all([
            synchronizeTaskNotifications(taskData),
            synchronizeEventNotifications(eventData),
          ]).catch((error) => console.error('Erro ao sincronizar notificações:', error))
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadWorkspace()
    return () => { mounted = false }
  }, [user.id])

  useEffect(() => {
    if (usesNativeNotifications()) return

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

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.start_at.localeCompare(b.start_at)), [events])

  async function handleCreateTask(input: NewStaffTask) {
    const task = await createTask(user.id, input)
    setTasks((current) => [task, ...current])
    if (notificationsEnabled) await scheduleTaskNotification(task).catch((error) => console.error('Erro ao programar tarefa:', error))
    return task
  }

  async function handleToggleTask(task: StaffTask) {
    const updated = await updateTask(user.id, task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })
    if (!updated) return
    setTasks((current) => current.map((item) => item.id === task.id ? updated : item))
    if (updated.status === 'completed') await cancelTaskNotification(updated.id).catch(() => undefined)
    else if (notificationsEnabled) await scheduleTaskNotification(updated).catch(() => undefined)
  }

  async function handleDeleteTask(task: StaffTask) {
    await deleteTask(user.id, task.id)
    await cancelTaskNotification(task.id).catch(() => undefined)
    setTasks((current) => current.filter((item) => item.id !== task.id))
  }

  async function handleCreateEvent(input: NewStaffEvent) {
    const created = await createEvent(user.id, input)
    setEvents((current) => [...current, ...created].sort((a, b) => a.start_at.localeCompare(b.start_at)))
    if (notificationsEnabled) await Promise.all(created.map(scheduleEventNotifications)).catch((error) => console.error('Erro ao programar evento:', error))
    return created
  }

  async function handleUpdateEvent(event: StaffEvent, updates: Partial<NewStaffEvent>) {
    await cancelEventNotifications(event).catch(() => undefined)
    const updated = await updateEvent(user.id, event.id, updates)
    if (!updated) return
    setEvents((current) => current.map((item) => item.id === event.id ? updated : item).sort((a, b) => a.start_at.localeCompare(b.start_at)))
    if (notificationsEnabled) await scheduleEventNotifications(updated).catch(() => undefined)
  }

  async function handleDeleteEvent(event: StaffEvent, wholeSeries = false) {
    const affected = wholeSeries && event.series_id ? events.filter((item) => item.series_id === event.series_id) : [event]
    await Promise.all(affected.map(cancelEventNotifications)).catch(() => undefined)
    await deleteEvent(user.id, event, wholeSeries)
    setEvents((current) => current.filter((item) => wholeSeries && event.series_id ? item.series_id !== event.series_id : item.id !== event.id))
  }

  async function handleCreateAutomation(input: NewStaffAutomation) {
    const automation = await createAutomation(user.id, input)
    setAutomations((current) => [...current, automation])
    return automation
  }

  async function handleToggleAutomation(automation: StaffAutomation) {
    const updated = await toggleAutomation(user.id, automation)
    setAutomations((current) => current.map((item) => item.id === automation.id ? updated : item))
  }

  async function handleDeleteAutomation(automation: StaffAutomation) {
    await deleteAutomation(user.id, automation.id)
    setAutomations((current) => current.filter((item) => item.id !== automation.id))
  }

  async function refreshNotifications() {
    setNotifications(await loadNotifications(user.id))
  }

  async function handleMarkNotificationRead(notification: StaffNotificationItem) {
    if (notification.read_at) return
    await markNotificationRead(user.id, notification.id)
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  async function toggleNotifications() {
    const granted = await requestStaffNotificationPermission()
    setNotificationsEnabled(granted)
    if (granted) {
      await showNotificationTest().catch(() => undefined)
      await Promise.all([
        synchronizeTaskNotifications(tasks),
        synchronizeEventNotifications(events),
      ]).catch((error) => console.error('Erro ao programar notificações:', error))
    }
  }

  function openLifeChat(prompt: string) {
    setPendingChatPrompt(prompt)
    setScreen('chat')
  }

  function navigate(nextScreen: StaffScreen) {
    setScreen(nextScreen)
    setMenuOpen(false)
  }

  const desktopNav = [
    { id: 'today' as StaffScreen, label: 'Hoje', icon: Home },
    { id: 'calendar' as StaffScreen, label: 'Agenda', icon: CalendarDays },
    { id: 'chat' as StaffScreen, label: 'Conversar', icon: MessageCircle },
    { id: 'tasks' as StaffScreen, label: 'Tarefas', icon: ListTodo },
    { id: 'life' as StaffScreen, label: 'Vida', icon: LayoutGrid },
    { id: 'automations' as StaffScreen, label: 'Automações', icon: Zap },
    { id: 'settings' as StaffScreen, label: 'Ajustes', icon: Settings },
  ]

  const mobileNav = [
    { id: 'today' as StaffScreen, label: 'Hoje', icon: Home },
    { id: 'calendar' as StaffScreen, label: 'Agenda', icon: CalendarDays },
    { id: 'tasks' as StaffScreen, label: 'Tarefas', icon: ListTodo },
    { id: 'chat' as StaffScreen, label: 'Conversar', icon: MessageCircle },
    { id: 'more' as StaffScreen, label: 'Mais', icon: MoreHorizontal },
  ]

  const mobileActive = ['life', 'automations', 'settings', 'more'].includes(screen) ? 'more' : screen
  const unreadCount = notifications.filter((item) => !item.read_at).length

  if (loading) {
    return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="text-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" /><p className="text-slate-500 mt-3">Organizando seu Staff...</p></div></div>
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <header className="fixed top-0 inset-x-0 z-40 bg-[#050816]/90 backdrop-blur-xl border-b border-slate-800/70 safe-area-top">
        <div className="h-16 px-4 md:px-6 flex items-center justify-between">
          <StaffLogo compact />
          <div className="flex items-center gap-2">
            <button onClick={toggleNotifications} className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-300" aria-label="Configurar notificações">
              {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-purple-600 text-[10px] text-white flex items-center justify-center">{Math.min(unreadCount, 9)}</span>}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800" aria-label="Abrir menu"><Menu className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <aside className={cn(
        'fixed z-30 top-16 bottom-0 left-0 w-64 bg-[#070b1a]/95 backdrop-blur-xl border-r border-slate-800 p-4 transition-transform md:translate-x-0 overflow-y-auto',
        menuOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 mb-5">
          <p className="text-xs text-slate-500">Seu Staff</p>
          <p className="font-bold text-white mt-1 truncate">{user.user_metadata?.name || user.email}</p>
          <p className="text-xs text-purple-300 mt-1">Plano gratuito</p>
        </div>
        <nav className="space-y-1">
          {desktopNav.map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)} className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
              screen === item.id
                ? 'bg-purple-500/15 text-purple-200 border border-purple-500/20'
                : 'text-slate-500 hover:bg-slate-900 hover:text-white border border-transparent',
            )}>
              <item.icon className="w-5 h-5" /><span className="font-medium">{item.label}</span>
              {item.id === 'automations' && unreadCount > 0 && <span className="ml-auto w-5 h-5 rounded-full bg-purple-600 text-[10px] flex items-center justify-center text-white">{Math.min(unreadCount, 9)}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-5 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
          <p className="text-xs font-semibold text-purple-200">Staff independente</p>
          <p className="text-[11px] text-slate-500 mt-1">Nexa é uma integração opcional.</p>
        </div>
      </aside>

      {menuOpen && <button onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/60 md:hidden" aria-label="Fechar menu" />}

      <main className="pt-20 pb-24 md:pb-8 md:pl-64 min-h-screen">
        <div className="p-4 md:p-7">
          {screen === 'today' && <TodayView user={user} tasks={sortedTasks} onCreate={handleCreateTask} onToggle={handleToggleTask} onDelete={handleDeleteTask} onNavigate={navigate} />}
          {screen === 'calendar' && <AgendaView events={sortedEvents} onCreate={handleCreateEvent} onUpdate={handleUpdateEvent} onDelete={handleDeleteEvent} />}
          {screen === 'tasks' && <TasksView tasks={sortedTasks} onCreateClick={() => setShowAddTask(true)} onToggle={handleToggleTask} onDelete={handleDeleteTask} />}
          {screen === 'chat' && (
            <ChatView
              user={user}
              tasks={sortedTasks}
              events={sortedEvents}
              automations={automations}
              messages={messages}
              setMessages={setMessages}
              onTaskCreated={handleCreateTask}
              onEventCreated={handleCreateEvent}
              onAutomationCreated={handleCreateAutomation}
              initialPrompt={pendingChatPrompt}
              onPromptConsumed={() => setPendingChatPrompt('')}
            />
          )}
          {screen === 'life' && <LifeView onOpenChat={openLifeChat} />}
          {screen === 'automations' && (
            <AutomationsView
              automations={automations}
              notifications={notifications}
              onToggle={handleToggleAutomation}
              onCreate={async (input) => { await handleCreateAutomation(input) }}
              onDelete={handleDeleteAutomation}
              onRefreshNotifications={refreshNotifications}
              onMarkRead={handleMarkNotificationRead}
            />
          )}
          {screen === 'settings' && <SettingsView notificationsEnabled={notificationsEnabled} onNotifications={toggleNotifications} onLogout={onLogout} nexaConnected={nexaConnected} />}
          {screen === 'more' && <MoreView onNavigate={navigate} />}
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#070b1a]/95 backdrop-blur-xl border-t border-slate-800 safe-area-bottom">
        <div className="grid grid-cols-5 px-2 py-2">
          {mobileNav.map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)} className={cn('relative flex flex-col items-center gap-1 py-1 text-[10px]', mobileActive === item.id ? 'text-purple-300' : 'text-slate-600')}>
              <item.icon className="w-5 h-5" />{item.label}
              {item.id === 'more' && unreadCount > 0 && <span className="absolute top-0 right-[26%] w-2 h-2 rounded-full bg-purple-500" />}
            </button>
          ))}
        </div>
      </nav>

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onCreate={async (task) => { await handleCreateTask(task) }} />}
    </div>
  )
}
