import { Capacitor } from '@capacitor/core'

const STAFF_PRODUCTION_ORIGIN = 'https://app.smartbots.club'
let nativeFetchBridgeInstalled = false

export function staffFunctionUrl(functionName: string) {
  const safeName = functionName.replace(/^\/+|\/+$/g, '')
  if (Capacitor.isNativePlatform()) {
    return `${STAFF_PRODUCTION_ORIGIN}/.netlify/functions/${safeName}`
  }
  return `/.netlify/functions/${safeName}`
}

export function installStaffNativeApiBridge() {
  if (!Capacitor.isNativePlatform() || nativeFetchBridgeInstalled) return

  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let nextInput: RequestInfo | URL = input

    if (typeof input === 'string' && input.startsWith('/.netlify/functions/')) {
      nextInput = `${STAFF_PRODUCTION_ORIGIN}${input}`
    } else if (input instanceof URL && input.pathname.startsWith('/.netlify/functions/')) {
      nextInput = new URL(`${input.pathname}${input.search}${input.hash}`, STAFF_PRODUCTION_ORIGIN)
    } else if (typeof Request !== 'undefined' && input instanceof Request) {
      const requestUrl = new URL(input.url)
      if (requestUrl.pathname.startsWith('/.netlify/functions/')) {
        const absoluteUrl = new URL(`${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`, STAFF_PRODUCTION_ORIGIN)
        nextInput = new Request(absoluteUrl, input)
      }
    }

    return originalFetch(nextInput, init)
  }) as typeof globalThis.fetch

  nativeFetchBridgeInstalled = true
}
