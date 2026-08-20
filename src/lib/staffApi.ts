import { Capacitor } from '@capacitor/core'

const STAFF_PRODUCTION_ORIGIN = 'https://app.smartbots.club'

export function staffFunctionUrl(functionName: string) {
  const safeName = functionName.replace(/^\/+|\/+$/g, '')
  if (Capacitor.isNativePlatform()) {
    return `${STAFF_PRODUCTION_ORIGIN}/.netlify/functions/${safeName}`
  }
  return `/.netlify/functions/${safeName}`
}
