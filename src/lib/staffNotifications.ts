import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { StaffTask } from '@/lib/staffData'

export function usesNativeNotifications() {
  return Capacitor.isNativePlatform()
}

function notificationId(taskId: string) {
  let hash = 0
  for (let index = 0; index < taskId.length; index += 1) {
    hash = ((hash << 5) - hash) + taskId.charCodeAt(index)
    hash |= 0
  }
  return Math.max(1, Math.abs(hash))
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

  const enabled = await notificationsAreEnabled()
  if (!enabled) return

  const id = notificationId(task.id)
  await LocalNotifications.cancel({ notifications: [{ id }] })
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: 'Staff',
        body: task.title,
        schedule: { at, allowWhileIdle: true },
        extra: { taskId: task.id, category: task.category },
      },
    ],
  })
}

export async function cancelTaskNotification(taskId: string) {
  if (!usesNativeNotifications()) return
  await LocalNotifications.cancel({ notifications: [{ id: notificationId(taskId) }] })
}

export async function synchronizeTaskNotifications(tasks: StaffTask[]) {
  if (!usesNativeNotifications()) return
  const enabled = await notificationsAreEnabled()
  if (!enabled) return

  await Promise.all(tasks.map(async (task) => {
    if (task.status === 'pending') await scheduleTaskNotification(task)
    else await cancelTaskNotification(task.id)
  }))
}

export async function showNotificationTest() {
  if (usesNativeNotifications()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 2147483000,
          title: 'Staff',
          body: 'Notificações ativadas com sucesso.',
          schedule: { at: new Date(Date.now() + 1500) },
        },
      ],
    })
    return
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Staff', { body: 'Notificações ativadas com sucesso.', icon: '/icon-192.png' })
  }
}
