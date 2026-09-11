import { createHash } from 'node:crypto'
import {
  buildDocumentFingerprint,
  canUseExternalProvider,
  confidenceBand,
  inferMimeFamily,
  normalizeDocumentExtraction,
  sanitizeTelemetryProperties,
} from './_shared/document-core.mjs'
import { resolveDocumentProvider } from './_shared/document-providers.mts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function serviceHeaders(secret: string, extra: Record<string, string> = {}) {
  return { apikey: secret, Authorization: `Bearer ${secret}`, ...extra }
}

async function getAuthenticatedUser(request: Request, supabaseUrl: string, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: secret, Authorization: authorization },
  })
  if (!response.ok) return null
  return response.json()
}

async function restJson(url: string, secret: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: serviceHeaders(secret, {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> || {}),
    }),
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(`supabase_rest_${response.status}`)
  return body
}

async function patchDocument(supabaseUrl: string, secret: string, userId: string, documentId: string, patch: Record<string, unknown>) {
  const url = `${supabaseUrl}/rest/v1/staff_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}`
  const rows = await restJson(url, secret, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  return Array.isArray(rows) ? rows[0] : null
}

async function track(supabaseUrl: string, secret: string, userId: string, eventName: string, entityId: string, properties: Record<string, unknown> = {}) {
  try {
    await restJson(`${supabaseUrl}/rest/v1/staff_telemetry_events`, secret, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        event_name: eventName,
        entity_id: entityId,
        properties: sanitizeTelemetryProperties(properties),
      }),
    })
  } catch (error) {
    console.error('smart-inbox telemetry warning:', error instanceof Error ? error.message : 'telemetry_error')
  }
}

function encodeStoragePath(path: string) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}

function documentPatch(extraction: ReturnType<typeof normalizeDocumentExtraction>, input: { provider: string; fileHash: string; duplicateOf?: string | null; fingerprint?: string | null; privacyClass: string }) {
  const detectedPrivacy = extraction.documentType === 'IDENTITY_DOCUMENT'
    ? 'identity'
    : extraction.documentType === 'MEDICAL_DOCUMENT'
      ? 'medical'
      : input.privacyClass

  return {
    document_type: extraction.documentType,
    status: 'needs_review',
    title: extraction.title,
    issuer: extraction.issuer,
    issuer_document: extraction.issuerDocument,
    recipient: extraction.recipient,
    document_number: extraction.documentNumber,
    issue_date: extraction.issueDate,
    due_date: extraction.dueDate,
    total_amount: extraction.totalAmount,
    currency: extraction.currency,
    payment_method: extraction.paymentMethod,
    items: extraction.items,
    parties: extraction.parties,
    obligations: extraction.obligations,
    summary: extraction.summary,
    raw_text: extraction.rawText,
    confidence: extraction.confidence,
    file_hash: input.fileHash,
    privacy_class: detectedPrivacy,
    provider: input.provider,
    provider_metadata: {
      processed_at: new Date().toISOString(),
      external_provider: input.provider !== 'mock',
      sensitive_type_detected: detectedPrivacy !== 'standard',
    },
    metadata: extraction.metadata,
    duplicate_of: input.duplicateOf || null,
    dedupe_fingerprint: input.fingerprint || null,
    error_code: null,
    error_message: null,
  }
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const secret = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!supabaseUrl || !secret) return json({ error: 'Smart Inbox ainda não foi configurado no servidor.' }, 500)

  const user = await getAuthenticatedUser(request, supabaseUrl, secret)
  if (!user?.id) return json({ error: 'Sua sessão expirou. Entre novamente no Staff.' }, 401)

  const payload = await request.json().catch(() => ({} as any)) as any
  const documentId = String(payload.document_id || '').trim()
  if (!documentId) return json({ error: 'Documento obrigatório.' }, 400)

  try {
    const rows = await restJson(
      `${supabaseUrl}/rest/v1/staff_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}&select=*`,
      secret,
    )
    const document = Array.isArray(rows) ? rows[0] : null
    if (!document) return json({ error: 'Documento não encontrado.' }, 404)

    const provider = resolveDocumentProvider(process.env)
    const privacyClass = String(document.privacy_class || 'standard')
    const userConsent = Boolean(document.external_processing_consent && payload.sensitive_processing_consent)
    const serverAllowsSensitive = String(process.env.STAFF_ALLOW_SENSITIVE_EXTERNAL_PROCESSING || '').toLowerCase() === 'true'

    if (!canUseExternalProvider({ privacyClass, providerExternal: provider.external, serverAllowsSensitive, userConsent })) {
      const message = 'Por privacidade, documentos de identidade e saúde não são enviados a serviços externos sem habilitação do servidor e consentimento explícito. O arquivo foi guardado com segurança para revisão.'
      const updated = await patchDocument(supabaseUrl, secret, user.id, documentId, {
        status: 'needs_review',
        error_code: 'SENSITIVE_EXTERNAL_PROCESSING_DISABLED',
        error_message: message,
      })
      return json({ document: updated, analysis_blocked: true, error: message }, 422)
    }

    await patchDocument(supabaseUrl, secret, user.id, documentId, { status: 'processing', error_code: null, error_message: null })

    const storageResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/staff-documents/${encodeStoragePath(String(document.file_path))}`,
      { headers: serviceHeaders(secret) },
    )
    if (!storageResponse.ok) throw new Error(`storage_download_${storageResponse.status}`)
    const bytes = Buffer.from(await storageResponse.arrayBuffer())
    if (bytes.length > 12 * 1024 * 1024) throw new Error('file_too_large')

    const fileHash = createHash('sha256').update(bytes).digest('hex')
    const extractionRaw = await provider.extract({
      fileName: String(document.file_name || 'documento'),
      mimeType: String(document.mime_type || 'application/octet-stream'),
      fileBase64: bytes.toString('base64'),
      privacyClass: privacyClass as 'standard' | 'identity' | 'medical',
    })

    const extraction = normalizeDocumentExtraction(extractionRaw, {
      fileName: document.file_name,
      mimeType: document.mime_type,
      fileHash,
    })
    const fingerprint = buildDocumentFingerprint(extraction, fileHash)

    let duplicateOf: string | null = null
    if (fingerprint) {
      const duplicateRows = await restJson(
        `${supabaseUrl}/rest/v1/staff_documents?user_id=eq.${encodeURIComponent(user.id)}&dedupe_fingerprint=eq.${encodeURIComponent(fingerprint)}&id=neq.${encodeURIComponent(documentId)}&status=neq.ignored&select=id&order=created_at.asc&limit=1`,
        secret,
      )
      duplicateOf = Array.isArray(duplicateRows) ? duplicateRows[0]?.id || null : null
    }

    const updated = await patchDocument(
      supabaseUrl,
      secret,
      user.id,
      documentId,
      documentPatch(extraction, { provider: provider.name, fileHash, duplicateOf, fingerprint, privacyClass }),
    )

    await track(supabaseUrl, secret, user.id, 'document.classified', documentId, {
      document_type: extraction.documentType,
      provider: provider.name,
      privacy_class: updated?.privacy_class || privacyClass,
      mime_family: inferMimeFamily(document.mime_type),
    })
    await track(supabaseUrl, secret, user.id, 'document.extracted', documentId, {
      document_type: extraction.documentType,
      provider: provider.name,
      privacy_class: updated?.privacy_class || privacyClass,
      confidence_band: confidenceBand(extraction.confidence),
      duplicate_detected: Boolean(duplicateOf),
    })

    return json({ document: updated, duplicate: Boolean(duplicateOf) })
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'document_analysis_error'
    console.error('smart-inbox analysis error:', code)
    await patchDocument(supabaseUrl, secret, user.id, documentId, {
      status: 'error',
      error_code: code,
      error_message: 'Não consegui analisar este arquivo agora. O documento continua salvo com segurança e você pode tentar novamente.',
    }).catch(() => undefined)
    return json({ error: 'Não consegui analisar este arquivo agora. Tente novamente em instantes.' }, 502)
  }
}
