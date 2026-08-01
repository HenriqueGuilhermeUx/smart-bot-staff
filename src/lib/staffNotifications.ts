import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { StaffTask } from '@/lib/staffData'
import type { StaffEvent } from '@/lib/staffCalendarData'

export function usesNativeNotifications() {
  return Capacitor.isNativePlatform()
}

function notificationId(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return (Math.abs(hash) % 2147483000) + 1
}

export async function notificationsAreEnabled(): Promise<boolean> {
  if (usesNativeNotifications()) {
    const permission = await LocalNotifications.checkPermissions()
    return permission.display === 'granted'
  }
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export async function requestStaffNotificationPermission(): Promise<boolean> {
  if (usesNativeNotifications()) {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true
    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function scheduleTaskNotification(task: StaffTask) {
  if (!usesNativeNotifications()) return
  const scheduleValue = task.remind_at || task.due_at
  if (!scheduleValue || task.status !== 'pending') return
  const at = new Date(scheduleValue)
  if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() + 1000) return
  if (!await notificationsAreEnabled()) return

  const id = notificationId(`task:${task.id}`)
  await LocalNotifications.cancel({ notifications: [{ id }] })
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: 'Staff',
      body: task.title,
      schedule: { at, allowWhileIdle: true },
      extra: { taskId: task.id, category: task.category, type: 'task' },
    }],
  })
}

export async function cancelTaskNotification(taskId: string) {
  if (!usesNativeNotifications()) return
  await LocalNotifications.cancel({ notifications: [{ id: notificationId(`task:${taskId}`) }] })
}

export async function synchronizeTaskNotifications(tasks: StaffTask[]) {
  if (!usesNativeNotifications() || !await notificationsAreEnabled()) return
  await Promise.all(tasks.map(async (task) => {
    if (task.status === 'pending') await scheduleTaskNotification(task)
    else await cancelTaskNotification(task.id)
  }))
}

export async function scheduleEventNotifications(event: StaffEvent) {
  if (!usesNativeNotifications() || event.status !== 'scheduled') return
  if (!await notificationsAreEnabled()) return

  const start = new Date(event.start_at).getTime()
  const reminders = event.reminder_minutes?.length ? event.reminder_minutes : [30]
  const notifications = reminders
    .map((minutesBefore) => ({
      id: notificationId(`event:${event.id}:${minutesBefore}`),
      title: 'Staff · Compromisso próximo',
      body: `${event.title}${event.location ? ` · ${event.location}` : ''}`,
      schedule: { at: new Date(start - minutesBefore * 60000), allowWhileIdle: true },
      extra: { eventId: event.id, category: event.category, type: 'event' },
    }))
    .filter((notification) => notification.schedule.at.getTime() > Date.now() + 1000)

  if (!notifications.length) return
  await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) })
  await LocalNotifications.schedule({ notifications })
}

export async function cancelEventNotifications(event: Pick<StaffEvent, 'id' | 'reminder_minutes'>) {
  if (!usesNativeNotifications()) return
  const reminders = event.reminder_minutes?.length ? event.reminder_minutes : [30]
  await LocalNotifications.cancel({
    notifications: reminders.map((minutesBefore) => ({ id: notificationId(`event:${event.id}:${minutesBefore}`) })),
  })
}

export async function synchronizeEventNotifications(events: StaffEvent[]) {
  if (!usesNativeNotifications() || !await notificationsAreEnabled()) return
  const future = events
    .filter((event) => event.status === 'scheduled' && new Date(event.start_at).getTime() > Date.now())
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 60)
  await Promise.all(future.map(scheduleEventNotifications))
}

export async function showNotificationTest() {
  if (usesNativeNotifications()) {
    await LocalNotifications.schedule({
      notifications: [{
        id: 2147483000,
        title: 'Staff',
        body: 'Notificações ativadas com sucesso.',
        schedule: { at: new Date(Date.now() + 1500) },
      }],
    })
    return
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Staff', { body: 'Notificações ativadas com sucesso.', icon: '/icon-192.png' })
  }
}
