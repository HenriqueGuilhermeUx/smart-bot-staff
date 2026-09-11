import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDocumentFingerprint,
  canUseExternalProvider,
  normalizeAmount,
  normalizeDocumentExtraction,
  sanitizeTelemetryProperties,
} from '../netlify/functions/_shared/document-core.mjs'

test('normaliza recibo e valores brasileiros', () => {
  const document = normalizeDocumentExtraction({
    documentType: 'receipt',
    issuer: 'Mercado XPTO',
    issueDate: '2026-09-10T13:00:00Z',
    totalAmount: 'R$ 1.238,90',
    confidence: 0.96,
  })
  assert.equal(document.documentType, 'RECEIPT')
  assert.equal(document.issueDate, '2026-09-10')
  assert.equal(document.totalAmount, 1238.9)
  assert.equal(document.confidence, 0.96)
})

test('normalização não inventa tipo/data e limita confidence', () => {
  const document = normalizeDocumentExtraction({ documentType: 'UNKNOWN', issueDate: 'amanhã', confidence: 9 })
  assert.equal(document.documentType, 'OTHER')
  assert.equal(document.issueDate, null)
  assert.equal(document.confidence, 1)
  assert.equal(normalizeAmount('-10'), null)
})

test('fingerprint é estável para issuer + valor + data + número', () => {
  const a = buildDocumentFingerprint({ issuer: 'Loja São José', totalAmount: 100, issueDate: '2026-09-10', documentNumber: 'NF-123' })
  const b = buildDocumentFingerprint({ issuer: 'LOJA SAO JOSE', totalAmount: '100,00', issueDate: '2026-09-10', documentNumber: 'NF 123' })
  const c = buildDocumentFingerprint({ issuer: 'LOJA SAO JOSE', totalAmount: 100, issueDate: '2026-09-10', documentNumber: 'NF-999' })
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('telemetria elimina conteúdo e conserva somente chaves agregáveis', () => {
  const sanitized = sanitizeTelemetryProperties({
    document_type: 'BILL',
    provider: 'internal_ai',
    raw_text: 'conteúdo privado',
    issuer: 'Empresa privada',
    total_amount: 900,
    duplicate_detected: true,
  })
  assert.deepEqual(sanitized, {
    document_type: 'BILL',
    provider: 'internal_ai',
    duplicate_detected: true,
  })
})

test('provedor externo é bloqueado para identidade/saúde por padrão', () => {
  assert.equal(canUseExternalProvider({ privacyClass: 'standard', providerExternal: true }), true)
  assert.equal(canUseExternalProvider({ privacyClass: 'identity', providerExternal: true }), false)
  assert.equal(canUseExternalProvider({ privacyClass: 'medical', providerExternal: true, serverAllowsSensitive: true, userConsent: false }), false)
  assert.equal(canUseExternalProvider({ privacyClass: 'identity', providerExternal: true, serverAllowsSensitive: true, userConsent: true }), true)
  assert.equal(canUseExternalProvider({ privacyClass: 'medical', providerExternal: false }), true)
})
