import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const browserFn = readFileSync(new URL('../netlify/functions/staff-browser-action.mts', import.meta.url), 'utf8')
const chat = readFileSync(new URL('../src/components/staff/ChatView.tsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../src/components/staff/LifeSettings.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20261011_staff_browser_actions_v1.sql', import.meta.url), 'utf8')

test('Browser Actions uses two phases and sends no reservation secrets during discovery', () => {
  const discoveryStart = browserFn.indexOf('async function startDiscovery')
  const bookingStart = browserFn.indexOf('async function startBooking')
  assert.ok(discoveryStart >= 0)
  assert.ok(bookingStart > discoveryStart)
  const discoveryBlock = browserFn.slice(discoveryStart, bookingStart)
  assert.equal(discoveryBlock.includes('reservation_phone'), false)
  assert.equal(discoveryBlock.includes('reservation_email'), false)
  assert.match(browserFn.slice(bookingStart), /allowedDomains/)
  assert.match(browserFn.slice(bookingStart), /secrets:/)
})

test('Browser Actions stops before sensitive transaction or auth steps', () => {
  assert.match(browserFn, /pagamento/)
  assert.match(browserFn, /cart[aã]o|cartao/)
  assert.match(browserFn, /OTP/)
  assert.match(browserFn, /login/)
  assert.match(browserFn, /needs_user/)
})

test('Restaurant reservation intent is wired to chat and voice flow', () => {
  assert.match(chat, /restaurantReservationIntent/)
  assert.match(chat, /runBrowserReservation/)
  assert.match(chat, /Agindo na web/)
  assert.match(chat, /addReservationToAgenda/)
})

test('Reservation profile is explicit and protected by authenticated RLS', () => {
  assert.match(settings, /Dados para reservas|dados para reservas|Ações na web/)
  assert.match(settings, /reservationPhone/)
  assert.match(migration, /reservation_phone/)
  assert.match(migration, /to authenticated/)
  assert.match(migration, /staff_web_actions_select_own/)
  assert.match(migration, /revoke all privileges on table public\.staff_profiles from public, anon, authenticated/)
})
