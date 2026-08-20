import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

const STAFF_PRODUCTION_ORIGIN = 'https://app.smartbots.club'
let staffFetchBridgeInstalled = false

export function staffFunctionUrl(functionName: string) {
  const safeName = functionName.replace(/^\/+|\/+$/g, '')
  if (Capacitor.isNativePlatform()) {
    return `${STAFF_PRODUCTION_ORIGIN}/.netlify/functions/${safeName}`
  }
  return `/.netlify/functions/${safeName}`
}

function staffFunctionPath(input: RequestInfo | URL) {
  try {
    if (typeof input === 'string') {
      if (input.startsWith('/.netlify/functions/')) return input
      const parsed = new URL(input, window.location.origin)
      return parsed.pathname.startsWith('/.netlify/functions/') ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null
    }
    if (input instanceof URL) {
      return input.pathname.startsWith('/.netlify/functions/') ? `${input.pathname}${input.search}${input.hash}` : null
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const parsed = new URL(input.url)
      return parsed.pathname.startsWith('/.netlify/functions/') ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null
    }
  } catch {
    return null
  }
  return null
}

export function installStaffNativeApiBridge() {
  if (staffFetchBridgeInstalled) return

  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const functionPath = staffFunctionPath(input)
    if (!functionPath) return originalFetch(input, init)

    let nextInput: RequestInfo | URL = input
    if (Capacitor.isNativePlatform()) {
      nextInput = `${STAFF_PRODUCTION_ORIGIN}${functionPath}`
    }

    const headers = new Headers(
      init?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined),
    )

    if (!headers.has('Authorization')) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
    }

    return originalFetch(nextInput, { ...init, headers })
  }) as typeof globalThis.fetch

  staffFetchBridgeInstalled = true
}
