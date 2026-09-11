export const DOCUMENT_TYPES = Object.freeze([
  'RECEIPT',
  'INVOICE',
  'BILL',
  'BANK_RECEIPT',
  'CONTRACT',
  'WARRANTY',
  'IDENTITY_DOCUMENT',
  'MEDICAL_DOCUMENT',
  'OTHER',
])

export const DOCUMENT_STATUSES = Object.freeze([
  'uploaded', 'processing', 'needs_review', 'confirmed', 'archived', 'ignored', 'error',
])

export const TELEMETRY_EVENTS = Object.freeze([
  'document.uploaded',
  'document.classified',
  'document.extracted',
  'document.confirmed',
  'financial_entry.created_from_document',
  'reminder.created_from_document',
])

const ALLOWED_TELEMETRY_KEYS = new Set([
  'document_type', 'status', 'provider', 'privacy_class', 'source', 'action_type',
  'duplicate_detected', 'confidence_band', 'mime_family',
])

function nullableString(value, max = 4000) {
  if (value === undefined || value === null) return null
  const result = String(value).replace(/\u0000/g, '').trim()
  return result ? result.slice(0, max) : null
}

function normalizeDate(value) {
  const text = nullableString(value, 64)
  if (!text) return null
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const test = new Date(Date.UTC(year, month - 1, day))
  if (test.getUTCFullYear() !== year || test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function normalizeAmount(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
  let text = String(value).trim().replace(/[^0-9,.-]/g, '')
  if (!text) return null
  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  if (comma > dot) text = text.replace(/\./g, '').replace(',', '.')
  else if (dot > comma && comma >= 0) text = text.replace(/,/g, '')
  else if (comma >= 0) text = text.replace(',', '.')
  const amount = Number(text)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null
}

function normalizeArray(value, maxItems = 60) {
  if (!Array.isArray(value)) return []
  return value.slice(0, maxItems).map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).slice(0, 20).map(([key, field]) => [key, typeof field === 'string' ? field.slice(0, 1000) : field]))
    }
    return typeof item === 'string' ? item.slice(0, 1000) : item
  })
}

export function normalizeDocumentExtraction(input = {}, sourceFile = {}) {
  const requestedType = nullableString(input.documentType || input.document_type, 64)?.toUpperCase()
  const documentType = DOCUMENT_TYPES.includes(requestedType) ? requestedType : 'OTHER'
  const confidenceRaw = Number(input.confidence)
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : null
  const currency = (nullableString(input.currency, 8) || 'BRL').toUpperCase()

  return {
    documentType,
    title: nullableString(input.title, 240),
    issuer: nullableString(input.issuer, 240),
    issuerDocument: nullableString(input.issuerDocument || input.issuer_document, 100),
    recipient: nullableString(input.recipient, 240),
    documentNumber: nullableString(input.documentNumber || input.document_number, 160),
    issueDate: normalizeDate(input.issueDate || input.issue_date),
    dueDate: normalizeDate(input.dueDate || input.due_date),
    totalAmount: normalizeAmount(input.totalAmount ?? input.total_amount),
    currency,
    paymentMethod: nullableString(input.paymentMethod || input.payment_method, 120),
    items: normalizeArray(input.items, 80),
    parties: normalizeArray(input.parties, 40),
    obligations: normalizeArray(input.obligations, 50),
    summary: nullableString(input.summary, 8000),
    rawText: nullableString(input.rawText || input.raw_text, 40000),
    confidence,
    sourceFile: {
      fileName: nullableString(sourceFile.fileName || sourceFile.file_name, 240),
      mimeType: nullableString(sourceFile.mimeType || sourceFile.mime_type, 160),
      fileHash: nullableString(sourceFile.fileHash || sourceFile.file_hash, 128),
    },
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
  }
}

function cleanFingerprintPart(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 160)
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0) || 0)
    hash = BigInt.asUintN(64, hash * prime)
  }
  return hash.toString(16).padStart(16, '0')
}

export function buildDocumentFingerprint(document, fileHash = '') {
  const normalized = normalizeDocumentExtraction(document)
  const issuer = cleanFingerprintPart(normalized.issuer)
  const amount = normalized.totalAmount === null ? '' : normalized.totalAmount.toFixed(2)
  const date = normalized.issueDate || normalized.dueDate || ''
  const documentNumber = cleanFingerprintPart(normalized.documentNumber)
  const fallbackHash = cleanFingerprintPart(fileHash).slice(0, 64)

  // Evita falso positivo quando a IA reconhece apenas um emissor genérico.
  // Preferimos identidade comercial quando há número do documento OU a combinação
  // emissor + valor + data. Fora disso, usamos o hash exato do arquivo.
  const hasStrongDocumentNumber = Boolean(documentNumber && (issuer || amount || date))
  const hasTransactionIdentity = Boolean(issuer && amount && date)
  const businessBasis = hasStrongDocumentNumber || hasTransactionIdentity
    ? [issuer, amount, date, documentNumber].join('|')
    : ''
  const basis = businessBasis || (fallbackHash ? `file|${fallbackHash}` : '')
  return basis ? `v2:${fnv1a64(basis)}` : null
}

export function confidenceBand(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'unknown'
  if (number >= 0.9) return 'high'
  if (number >= 0.7) return 'medium'
  return 'low'
}

export function sanitizeTelemetryProperties(properties = {}) {
  const result = {}
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return result
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_TELEMETRY_KEYS.has(key)) continue
    if (typeof value === 'boolean') result[key] = value
    else if (typeof value === 'string' || typeof value === 'number') result[key] = String(value).slice(0, 120)
  }
  return result
}

export function canUseExternalProvider({ privacyClass = 'standard', providerExternal = true, serverAllowsSensitive = false, userConsent = false } = {}) {
  if (!providerExternal) return true
  if (privacyClass === 'standard') return true
  return Boolean(serverAllowsSensitive && userConsent)
}

export function inferMimeFamily(mimeType = '') {
  if (String(mimeType).startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'text/plain') return 'text'
  if (String(mimeType).includes('word')) return 'document'
  return 'other'
}
