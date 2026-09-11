import { getSession, supabase } from '@/lib/supabase'
import type { NewStaffTask, StaffCategory } from '@/lib/staffData'
import type { NewStaffEvent } from '@/lib/staffCalendarData'

export type StaffDocumentType =
  | 'RECEIPT'
  | 'INVOICE'
  | 'BILL'
  | 'BANK_RECEIPT'
  | 'CONTRACT'
  | 'WARRANTY'
  | 'IDENTITY_DOCUMENT'
  | 'MEDICAL_DOCUMENT'
  | 'OTHER'

export type StaffDocumentStatus = 'uploaded' | 'processing' | 'needs_review' | 'confirmed' | 'archived' | 'ignored' | 'error'
export type StaffDocumentPrivacy = 'standard' | 'identity' | 'medical'

export type StaffDocumentItem = {
  description?: string | null
  quantity?: number | null
  unitPrice?: number | null
  total?: number | null
  [key: string]: unknown
}

export type StaffDocumentObligation = {
  description?: string | null
  dueDate?: string | null
  importance?: string | null
  [key: string]: unknown
}

export interface StaffDocument {
  id: string
  user_id: string
  document_type: StaffDocumentType
  status: StaffDocumentStatus
  title: string | null
  issuer: string | null
  issuer_document: string | null
  recipient: string | null
  document_number: string | null
  issue_date: string | null
  due_date: string | null
  total_amount: number | null
  currency: string
  payment_method: string | null
  items: StaffDocumentItem[]
  parties: Array<Record<string, unknown>>
  obligations: StaffDocumentObligation[]
  summary: string | null
  raw_text: string | null
  confidence: number | null
  file_path: string
  file_name: string
  mime_type: string
  file_size: number
  file_hash: string | null
  privacy_class: StaffDocumentPrivacy
  external_processing_consent: boolean
  provider: string | null
  provider_metadata: Record<string, unknown>
  metadata: Record<string, unknown>
  duplicate_of: string | null
  dedupe_fingerprint: string | null
  error_code: string | null
  error_message: string | null
  confirmed_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface StaffFinancialEntry {
  id: string
  user_id: string
  entry_type: 'expense' | 'income'
  description: string
  amount: number
  currency: string
  occurred_on: string
  category: string
  merchant: string | null
  payment_method: string | null
  source_document_id: string | null
  dedupe_fingerprint: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DocumentReviewUpdates = Partial<Pick<StaffDocument,
  'document_type' | 'title' | 'issuer' | 'issuer_document' | 'recipient' | 'document_number' |
  'issue_date' | 'due_date' | 'total_amount' | 'currency' | 'payment_method' | 'summary'
>>

export const DOCUMENT_TYPE_LABELS: Record<StaffDocumentType, string> = {
  RECEIPT: 'Recibo',
  INVOICE: 'Nota / Fatura',
  BILL: 'Boleto / Conta',
  BANK_RECEIPT: 'Comprovante bancário',
  CONTRACT: 'Contrato',
  WARRANTY: 'Garantia',
  IDENTITY_DOCUMENT: 'Documento de identidade',
  MEDICAL_DOCUMENT: 'Documento médico',
  OTHER: 'Outro documento',
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function makeUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    const next = char === 'x' ? value : (value & 0x3) | 0x8
    return next.toString(16)
  })
}

function safeFileName(name: string) {
  return (name || 'documento').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

function documentError(error: any, fallback: string) {
  const message = String(error?.message || error || '')
  if (/could not find the table|schema cache|PGRST205|42P01/i.test(message)) {
    return new Error('O Smart Inbox ainda não está disponível no banco deste ambiente. Execute a migration do Smart Inbox e tente novamente.')
  }
  if (/row-level security|permission|jwt|session/i.test(message)) return new Error('Sua sessão não conseguiu acessar o Smart Inbox. Entre novamente no Staff.')
  if (/failed to fetch|network|connection|dns/i.test(message)) return new Error('Não consegui sincronizar o Smart Inbox. Verifique sua internet e tente novamente.')
  return new Error(message || fallback)
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1_200_000 || !('createImageBitmap' in globalThis)) return file
  const bitmap = await createImageBitmap(file)
  const maxSide = 2200
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) { bitmap.close(); return file }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) return file
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'documento'}.jpg`, { type: 'image/jpeg' })
}

async function sha256(file: File) {
  if (!crypto?.subtle) return null
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function prepareDocumentFile(file: File) {
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(mime) && !mime.startsWith('image/')) {
    throw new Error('Envie foto, PDF, TXT, DOC ou DOCX.')
  }
  const prepared = await compressImage(file)
  if (prepared.size > 12 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 12 MB.')
  return prepared
}

function safeTelemetry(properties: Record<string, unknown>) {
  const allowed = new Set(['document_type','status','provider','privacy_class','source','action_type','duplicate_detected','confidence_band','mime_family'])
  return Object.fromEntries(Object.entries(properties).filter(([key]) => allowed.has(key)).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value).slice(0, 120)]))
}

export async function trackDocumentEvent(userId: string, eventName: string, entityId: string, properties: Record<string, unknown> = {}) {
  const { error } = await supabase.from('staff_telemetry_events').insert({
    user_id: userId,
    event_name: eventName,
    entity_id: entityId,
    properties: safeTelemetry(properties),
  })
  if (error) console.warn('Smart Inbox telemetry indisponível:', error.code || 'telemetry_error')
}

export async function listDocuments(userId: string): Promise<StaffDocument[]> {
  const { data, error } = await supabase.from('staff_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
  if (error) throw documentError(error, 'Não consegui carregar seus documentos.')
  return (data || []) as StaffDocument[]
}

export async function uploadDocument(input: {
  userId: string
  file: File
  privacyClass: StaffDocumentPrivacy
  sensitiveProcessingConsent?: boolean
}) {
  const file = await prepareDocumentFile(input.file)
  const id = makeUuid()
  const fileHash = await sha256(file)
  const path = `${input.userId}/${id}/${Date.now()}-${safeFileName(file.name)}`
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Novo documento'

  const { data, error } = await supabase.from('staff_documents').insert({
    id,
    user_id: input.userId,
    document_type: input.privacyClass === 'identity' ? 'IDENTITY_DOCUMENT' : input.privacyClass === 'medical' ? 'MEDICAL_DOCUMENT' : 'OTHER',
    status: 'uploaded',
    title,
    file_path: path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    file_hash: fileHash,
    privacy_class: input.privacyClass,
    external_processing_consent: Boolean(input.sensitiveProcessingConsent),
  }).select('*').single()
  if (error) throw documentError(error, 'Não consegui criar o documento.')

  const { error: uploadError } = await supabase.storage.from('staff-documents').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    await supabase.from('staff_documents').delete().eq('id', id).eq('user_id', input.userId)
    throw documentError(uploadError, 'Não consegui guardar o arquivo.')
  }

  await trackDocumentEvent(input.userId, 'document.uploaded', id, {
    document_type: data.document_type,
    privacy_class: input.privacyClass,
    mime_family: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'document',
  })

  if (input.privacyClass !== 'standard' && !input.sensitiveProcessingConsent) {
    const { data: protectedDocument, error: protectedError } = await supabase.from('staff_documents').update({
      status: 'needs_review',
      error_code: 'SENSITIVE_EXTERNAL_PROCESSING_NOT_REQUESTED',
      error_message: 'Arquivo privado salvo. A análise externa não foi solicitada para este conteúdo sensível.',
    }).eq('id', id).eq('user_id', input.userId).select('*').single()
    if (protectedError) throw documentError(protectedError, 'O arquivo foi salvo, mas não consegui atualizar seu status.')
    return protectedDocument as StaffDocument
  }

  return analyzeDocument(id, Boolean(input.sensitiveProcessingConsent))
}

export async function analyzeDocument(documentId: string, sensitiveProcessingConsent = false): Promise<StaffDocument> {
  const session = await getSession()
  if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente no Staff.')
  const response = await fetch('/.netlify/functions/staff-document-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ document_id: documentId, sensitive_processing_consent: sensitiveProcessingConsent }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok && payload.document) return payload.document as StaffDocument
  if (!response.ok) throw new Error(payload.error || 'Não consegui analisar o documento agora.')
  return payload.document as StaffDocument
}

export async function updateDocumentReview(userId: string, documentId: string, updates: DocumentReviewUpdates): Promise<StaffDocument> {
  const payload = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined))
  const { data, error } = await supabase.from('staff_documents').update(payload).eq('id', documentId).eq('user_id', userId).select('*').single()
  if (error) throw documentError(error, 'Não consegui salvar a revisão.')
  return data as StaffDocument
}

async function recordAction(userId: string, documentId: string, actionType: string, targetType?: string, targetId?: string, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.from('staff_document_actions').insert({
    user_id: userId,
    document_id: documentId,
    action_type: actionType,
    status: 'completed',
    target_type: targetType || null,
    target_id: targetId || null,
    metadata,
  })
  if (error) console.warn('Smart Inbox action audit indisponível:', error.code || 'action_error')
}

export async function confirmDocument(userId: string, document: StaffDocument, updates: DocumentReviewUpdates = {}) {
  const { data, error } = await supabase.from('staff_documents').update({
    ...updates,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    error_code: null,
    error_message: null,
  }).eq('id', document.id).eq('user_id', userId).select('*').single()
  if (error) throw documentError(error, 'Não consegui confirmar o documento.')
  await recordAction(userId, document.id, 'CONFIRM')
  await trackDocumentEvent(userId, 'document.confirmed', document.id, { document_type: data.document_type, status: 'confirmed' })
  return data as StaffDocument
}

export async function archiveDocument(userId: string, document: StaffDocument) {
  const { data, error } = await supabase.from('staff_documents').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', document.id).eq('user_id', userId).select('*').single()
  if (error) throw documentError(error, 'Não consegui arquivar o documento.')
  await recordAction(userId, document.id, 'SAVE_DOCUMENT')
  return data as StaffDocument
}

export async function ignoreDocument(userId: string, document: StaffDocument) {
  const { data, error } = await supabase.from('staff_documents').update({ status: 'ignored' }).eq('id', document.id).eq('user_id', userId).select('*').single()
  if (error) throw documentError(error, 'Não consegui ignorar o documento.')
  await recordAction(userId, document.id, 'IGNORE')
  return data as StaffDocument
}

export async function deleteDocument(userId: string, document: StaffDocument) {
  if (document.file_path) {
    const { error: storageError } = await supabase.storage.from('staff-documents').remove([document.file_path])
    if (storageError) throw documentError(storageError, 'Não consegui excluir o arquivo privado.')
  }
  const { error } = await supabase.from('staff_documents').delete().eq('id', document.id).eq('user_id', userId)
  if (error) throw documentError(error, 'Não consegui excluir o documento.')
}

export async function getSignedDocumentUrl(document: StaffDocument) {
  const { data, error } = await supabase.storage.from('staff-documents').createSignedUrl(document.file_path, 120)
  if (error || !data?.signedUrl) throw documentError(error, 'Não consegui abrir o arquivo original.')
  return data.signedUrl
}

function suggestCategory(document: StaffDocument) {
  const text = `${document.issuer || ''} ${document.title || ''} ${document.summary || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/(mercado|supermerc|restaurante|padaria|aliment)/.test(text)) return 'Alimentação'
  if (/(energia|eletric|agua|gas|internet|telefone|condominio)/.test(text)) return 'Casa'
  if (/(farmacia|hospital|clinica|medic|saude)/.test(text)) return 'Saúde'
  if (/(uber|99|posto|combust|estacion|transporte)/.test(text)) return 'Transporte'
  if (/(escola|curso|livro|faculdade|educa)/.test(text)) return 'Educação'
  return 'Outros'
}

export async function loadFinancialEntries(userId: string): Promise<StaffFinancialEntry[]> {
  const { data, error } = await supabase.from('staff_financial_entries').select('*').eq('user_id', userId).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(300)
  if (error) throw documentError(error, 'Não consegui carregar seus lançamentos.')
  return (data || []) as StaffFinancialEntry[]
}

export async function registerExpenseFromDocument(userId: string, document: StaffDocument) {
  if (document.status !== 'confirmed' && document.status !== 'archived') throw new Error('Confirme os dados do documento antes de registrar a despesa.')
  if (document.total_amount === null || document.total_amount === undefined) throw new Error('Revise e informe o valor antes de registrar a despesa.')

  const candidateIds = [document.id, document.duplicate_of].filter(Boolean) as string[]
  if (candidateIds.length) {
    const { data: byDocument } = await supabase.from('staff_financial_entries').select('*').eq('user_id', userId).in('source_document_id', candidateIds).limit(1)
    if (byDocument?.[0]) return { entry: byDocument[0] as StaffFinancialEntry, duplicate: true }
  }
  if (document.dedupe_fingerprint) {
    const { data: byFingerprint } = await supabase.from('staff_financial_entries').select('*').eq('user_id', userId).eq('dedupe_fingerprint', document.dedupe_fingerprint).limit(1)
    if (byFingerprint?.[0]) return { entry: byFingerprint[0] as StaffFinancialEntry, duplicate: true }
  }

  const { data, error } = await supabase.from('staff_financial_entries').insert({
    user_id: userId,
    entry_type: 'expense',
    description: document.title || document.issuer || 'Despesa importada pelo Smart Inbox',
    amount: Number(document.total_amount),
    currency: document.currency || 'BRL',
    occurred_on: document.issue_date || new Date().toISOString().slice(0, 10),
    category: suggestCategory(document),
    merchant: document.issuer,
    payment_method: document.payment_method,
    source_document_id: document.id,
    dedupe_fingerprint: document.dedupe_fingerprint,
    metadata: { source: 'smart_inbox', document_type: document.document_type },
  }).select('*').single()
  if (error) throw documentError(error, 'Não consegui registrar a despesa.')
  await recordAction(userId, document.id, 'REGISTER_EXPENSE', 'financial_entry', data.id)
  await trackDocumentEvent(userId, 'financial_entry.created_from_document', document.id, { document_type: document.document_type, action_type: 'REGISTER_EXPENSE' })
  return { entry: data as StaffFinancialEntry, duplicate: false }
}

export async function addDocumentToMemory(userId: string, document: StaffDocument) {
  if (document.status !== 'confirmed' && document.status !== 'archived') throw new Error('Confirme os dados antes de adicionar este documento à memória.')
  const { data: existing } = await supabase.from('staff_memories').select('id').eq('user_id', userId).eq('source_document_id', document.id).limit(1)
  if (existing?.[0]) return existing[0]
  const source = document.title || DOCUMENT_TYPE_LABELS[document.document_type]
  const facts = [
    document.summary,
    document.issuer ? `Emissor/estabelecimento: ${document.issuer}.` : null,
    document.issue_date ? `Data: ${document.issue_date}.` : null,
    document.due_date ? `Vencimento/prazo: ${document.due_date}.` : null,
    document.total_amount !== null ? `Valor: ${document.currency || 'BRL'} ${Number(document.total_amount).toFixed(2)}.` : null,
  ].filter(Boolean).join(' ')
  const { data, error } = await supabase.from('staff_memories').insert({
    user_id: userId,
    category: document.document_type === 'RECEIPT' || document.document_type === 'INVOICE' || document.document_type === 'BILL' ? 'financas' : 'documentos',
    content: `[Fonte documental: ${source}] ${facts}`.slice(0, 12000),
    importance: 3,
    user_confirmed: true,
    source_document_id: document.id,
  }).select('id').single()
  if (error) throw documentError(error, 'Não consegui adicionar à memória.')
  await recordAction(userId, document.id, 'ADD_MEMORY', 'memory', data.id)
  return data
}

export async function linkDocumentToPerson(userId: string, document: StaffDocument, personLabel: string) {
  const label = personLabel.trim()
  if (!label) throw new Error('Informe a pessoa relacionada.')
  const { data, error } = await supabase.from('staff_document_links').insert({
    user_id: userId,
    document_id: document.id,
    entity_type: 'person',
    entity_label: label,
  }).select('*').single()
  if (error) throw documentError(error, 'Não consegui vincular a pessoa.')
  await recordAction(userId, document.id, 'LINK_PERSON', 'person', data.id, { label: label.slice(0, 80) })
  return data
}

export function reminderFromDocument(document: StaffDocument): NewStaffTask {
  if (!document.due_date) throw new Error('Este documento não tem vencimento ou prazo identificado. Revise a data primeiro.')
  const due = new Date(`${document.due_date}T09:00:00`)
  const daysBefore = document.document_type === 'WARRANTY' ? 30 : 3
  const remind = new Date(due)
  remind.setDate(remind.getDate() - daysBefore)
  const title = document.document_type === 'WARRANTY'
    ? `Garantia: ${document.title || document.issuer || 'documento'}`
    : `Vencimento: ${document.title || document.issuer || DOCUMENT_TYPE_LABELS[document.document_type]}`
  return {
    title,
    notes: `Criado pelo Smart Inbox. Fonte documental: ${document.title || document.file_name}.`,
    category: (document.document_type === 'BILL' ? 'financas' : 'documentos') as StaffCategory,
    priority: 'normal',
    due_at: due.toISOString(),
    remind_at: remind.toISOString(),
    source: 'integration',
  }
}

export function eventFromDocument(document: StaffDocument): NewStaffEvent {
  const date = document.due_date || document.issue_date
  if (!date) throw new Error('Revise uma data antes de adicionar este documento à agenda.')
  const start = new Date(`${date}T09:00:00`)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const reminderMinutes = document.document_type === 'WARRANTY' ? [43200] : [4320, 1440]
  return {
    title: document.title || DOCUMENT_TYPE_LABELS[document.document_type],
    description: `Criado pelo Smart Inbox. Fonte documental: ${document.file_name}.`,
    category: document.document_type === 'BILL' ? 'financas' : 'documentos',
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    source: 'integration',
    reminder_minutes: reminderMinutes,
  }
}

export async function recordReminderCreated(userId: string, document: StaffDocument, taskId: string) {
  await recordAction(userId, document.id, 'CREATE_REMINDER', 'task', taskId)
  await trackDocumentEvent(userId, 'reminder.created_from_document', document.id, { document_type: document.document_type, action_type: 'CREATE_REMINDER' })
}

export async function recordEventCreated(userId: string, document: StaffDocument, eventId: string) {
  await recordAction(userId, document.id, 'ADD_EVENT', 'event', eventId)
}
