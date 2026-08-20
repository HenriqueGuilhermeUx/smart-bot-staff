const PIN_HASH_KEY = 'staff_parental_pin_hash_v1'
const SESSION_MINUTES_KEY = 'staff_kids_session_minutes_v1'

async function digest(value: string) {
  const normalized = `staff-parental-v1:${value.trim()}`
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(normalized)
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return btoa(normalized)
}

export function hasParentalPin() {
  return Boolean(localStorage.getItem(PIN_HASH_KEY))
}

export async function setParentalPin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('Use um PIN de 4 a 6 números.')
  localStorage.setItem(PIN_HASH_KEY, await digest(pin))
}

export async function verifyParentalPin(pin: string) {
  const stored = localStorage.getItem(PIN_HASH_KEY)
  if (!stored) return false
  return stored === await digest(pin)
}

export function clearParentalPin() {
  localStorage.removeItem(PIN_HASH_KEY)
}

export function getKidsSessionMinutes() {
  const value = Number(localStorage.getItem(SESSION_MINUTES_KEY) || '10')
  return [5, 10, 15].includes(value) ? value : 10
}

export function setKidsSessionMinutes(minutes: number) {
  if (![5, 10, 15].includes(minutes)) throw new Error('Escolha 5, 10 ou 15 minutos.')
  localStorage.setItem(SESSION_MINUTES_KEY, String(minutes))
}
