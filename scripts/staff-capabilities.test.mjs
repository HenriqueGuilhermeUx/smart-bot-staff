import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const gateway = await readFile(new URL('../netlify/functions/staff-capabilities.mts', import.meta.url), 'utf8')
const worker = await readFile(new URL('../netlify/functions/staff-capabilities-worker.mts', import.meta.url), 'utf8')
const core = await readFile(new URL('../netlify/functions/_shared/staff-capabilities-core.mts', import.meta.url), 'utf8')
const store = await readFile(new URL('../netlify/functions/_shared/staff-capability-store.mts', import.meta.url), 'utf8')
const nexa = await readFile(new URL('../netlify/functions/nexa-personal-assistant.mts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20261012_staff_capabilities_gateway_v1.sql', import.meta.url), 'utf8')

test('Nexa reuses the existing service bridge and restaurant capability', () => {
  assert.match(gateway, /STAFF_NEXA_SERVICE_KEY/)
  assert.match(gateway, /web\.restaurant\.reserve/)
  assert.match(nexa, /staff-capabilities/)
  assert.match(nexa, /web\.restaurant\.reserve/)
  assert.match(nexa, /nexa-personal-v4/)
})

test('Nexa booking requires explicit confirmation and protected contact bindings', () => {
  assert.match(worker, /confirmationKind: 'confirm_booking'/)
  assert.match(gateway, /kind === 'confirm_booking'/)
  assert.match(gateway, /responda “sim”/)
  assert.match(core, /secretBindings/)
  assert.match(core, /allowedDomains/)
  assert.match(core, /reservation_name/)
  assert.match(core, /reservation_email/)
  assert.match(core, /reservation_phone/)
  assert.match(core, /pagamento, depósito, cartão, login, criação de conta, senha, OTP\/2FA/)
})

test('Federated actions run in a background worker without using the DB secret as bearer auth', () => {
  assert.match(worker, /background: true/)
  assert.match(worker, /STAFF_CAPABILITIES_INTERNAL_KEY/)
  assert.match(worker, /STAFF_NEXA_SERVICE_KEY/)
  assert.doesNotMatch(worker, /Bearer \$\{serviceKey\}/)
  assert.match(gateway, /staff-capabilities-worker/)
})

test('Health appointment search is ephemeral and excludes clinical context', () => {
  assert.match(gateway, /web\.appointment\.search/)
  assert.match(gateway, /persistedInStaff: false/)
  assert.match(gateway, /clinicalContextIncluded: false/)
  assert.match(gateway, /external_web_search_consent/)
  assert.match(core, /Não envie nome, e-mail, telefone, documento, carteirinha, exame, diagnóstico, sintoma, medicamento ou prontuário/)
  assert.doesNotMatch(gateway, /medical_records/)
  assert.doesNotMatch(gateway, /medications/)
  assert.doesNotMatch(gateway, /health_scores/)
})

test('Health federation validates the native HealthWallet session', () => {
  assert.match(gateway, /STAFF_HEALTHWALLET_SESSION_URL/)
  assert.match(gateway, /https:\/\/mydatamed\.com\/api\/staff\/session/)
  assert.match(gateway, /payload\?\.valid === true/)
})

test('Federated action rows remain separated from authenticated Staff ownership', () => {
  assert.match(migration, /alter column user_id drop not null/)
  assert.match(migration, /source_app text not null default 'staff'/)
  assert.match(migration, /external_subject_id text/)
  assert.match(migration, /source_app = 'staff' and user_id is not null/)
  assert.match(migration, /source_app <> 'staff' and user_id is null/)
  assert.match(migration, /grant select on public\.staff_web_actions to authenticated/)
  assert.match(migration, /grant select, insert, update, delete on public\.staff_web_actions to service_role/)
  assert.match(store, /user_id: null/)
})

test('Status can recover the latest completed federated action', () => {
  assert.match(store, /findLatestFederatedAction/)
  assert.match(gateway, /findLatestFederatedAction/)
  assert.match(gateway, /looksLikeStatusRequest/)
})

test('Browser Use stays on V4 with bounded cost and recording disabled', () => {
  assert.match(core, /api\/v4/)
  assert.match(core, /gpt-5\.6-luna/)
  assert.match(core, /maxCostUsd/)
  assert.match(core, /record: false/)
  assert.match(core, /0\.35/)
  assert.match(core, /0\.45/)
  assert.match(core, /0\.30/)
})
