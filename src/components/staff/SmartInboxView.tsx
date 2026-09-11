import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Archive, CalendarPlus, Camera, Check, CheckCircle2, CircleDollarSign,
  Clock3, ExternalLink, FileSearch, FileText, Inbox, Link2, Loader2, RefreshCw, Save,
  Sparkles, Trash2, Upload, UserRoundPlus, XCircle,
} from 'lucide-react'
import type { NewStaffTask, StaffTask } from '@/lib/staffData'
import type { NewStaffEvent, StaffEvent } from '@/lib/staffCalendarData'
import type { StaffScreen } from '@/lib/staffUi'
import { cn } from '@/lib/staffUi'
import {
  DOCUMENT_TYPE_LABELS,
  addDocumentToMemory,
  analyzeDocument,
  archiveDocument,
  confirmDocument,
  deleteDocument,
  eventFromDocument,
  getSignedDocumentUrl,
  ignoreDocument,
  linkDocumentToPerson,
  listDocuments,
  recordEventCreated,
  recordReminderCreated,
  registerExpenseFromDocument,
  reminderFromDocument,
  updateDocumentReview,
  uploadDocument,
  type DocumentReviewUpdates,
  type StaffDocument,
  type StaffDocumentPrivacy,
  type StaffDocumentType,
} from '@/lib/staffDocuments'

type FilterKey = 'all' | 'review' | 'processed' | 'archived' | 'errors'

type Draft = {
  document_type: StaffDocumentType
  title: string
  issuer: string
  issuer_document: string
  recipient: string
  document_number: string
  issue_date: string
  due_date: string
  total_amount: string
  currency: string
  payment_method: string
  summary: string
}

const EMPTY_DRAFT: Draft = {
  document_type: 'OTHER', title: '', issuer: '', issuer_document: '', recipient: '', document_number: '',
  issue_date: '', due_date: '', total_amount: '', currency: 'BRL', payment_method: '', summary: '',
}

function toDraft(document: StaffDocument): Draft {
  return {
    document_type: document.document_type,
    title: document.title || '',
    issuer: document.issuer || '',
    issuer_document: document.issuer_document || '',
    recipient: document.recipient || '',
    document_number: document.document_number || '',
    issue_date: document.issue_date || '',
    due_date: document.due_date || '',
    total_amount: document.total_amount === null ? '' : String(document.total_amount),
    currency: document.currency || 'BRL',
    payment_method: document.payment_method || '',
    summary: document.summary || '',
  }
}

function draftUpdates(draft: Draft): DocumentReviewUpdates {
  const amount = draft.total_amount.trim() === '' ? null : Number(draft.total_amount.replace(',', '.'))
  return {
    document_type: draft.document_type,
    title: draft.title.trim() || null,
    issuer: draft.issuer.trim() || null,
    issuer_document: draft.issuer_document.trim() || null,
    recipient: draft.recipient.trim() || null,
    document_number: draft.document_number.trim() || null,
    issue_date: draft.issue_date || null,
    due_date: draft.due_date || null,
    total_amount: amount !== null && Number.isFinite(amount) && amount >= 0 ? amount : null,
    currency: (draft.currency.trim() || 'BRL').toUpperCase(),
    payment_method: draft.payment_method.trim() || null,
    summary: draft.summary.trim() || null,
  }
}

function formatMoney(value: number | null, currency = 'BRL') {
  if (value === null || value === undefined) return 'Não identificado'
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value) }
  catch { return `${currency} ${Number(value).toFixed(2)}` }
}

function statusLabel(status: StaffDocument['status']) {
  return ({
    uploaded: 'Enviado', processing: 'Analisando', needs_review: 'Aguardando revisão', confirmed: 'Confirmado',
    archived: 'Arquivado', ignored: 'Ignorado', error: 'Erro',
  } as const)[status]
}

function privacyLabel(privacy: StaffDocumentPrivacy) {
  if (privacy === 'identity') return 'Identidade'
  if (privacy === 'medical') return 'Saúde'
  return 'Comum'
}

function statusTone(status: StaffDocument['status']) {
  if (status === 'confirmed' || status === 'archived') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  if (status === 'error') return 'text-rose-300 bg-rose-500/10 border-rose-500/20'
  if (status === 'needs_review') return 'text-amber-200 bg-amber-500/10 border-amber-500/20'
  return 'text-slate-400 bg-slate-900 border-slate-800'
}

export function SmartInboxView({
  userId,
  onCreateTask,
  onCreateEvent,
  onNavigate,
}: {
  userId: string
  onCreateTask: (input: NewStaffTask) => Promise<StaffTask>
  onCreateEvent: (input: NewStaffEvent) => Promise<StaffEvent[]>
  onNavigate: (screen: StaffScreen) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<StaffDocument[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [privacyClass, setPrivacyClass] = useState<StaffDocumentPrivacy | ''>('')
  const [sensitiveConsent, setSensitiveConsent] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [working, setWorking] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [person, setPerson] = useState('')
  const [showPerson, setShowPerson] = useState(false)

  const selected = documents.find((item) => item.id === selectedId) || documents[0]

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const list = await listDocuments(userId)
      setDocuments(list)
      setSelectedId((current) => current && list.some((item) => item.id === current) ? current : list[0]?.id || '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não consegui carregar o Smart Inbox.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [userId])
  useEffect(() => { setDraft(selected ? toDraft(selected) : EMPTY_DRAFT); setShowPerson(false); setPerson('') }, [selected?.id])

  function replaceDocument(document: StaffDocument) {
    setDocuments((current) => current.some((item) => item.id === document.id)
      ? current.map((item) => item.id === document.id ? document : item)
      : [document, ...current])
    setSelectedId(document.id)
  }

  function chooseFile(next: File | null) {
    setFile(next)
    setPrivacyClass('')
    setSensitiveConsent(false)
    setError('')
    setMessage('')
  }

  async function processUpload() {
    if (!file || !privacyClass) return
    setUploading(true)
    setError('')
    setMessage('Guardando o arquivo privado...')
    try {
      const document = await uploadDocument({
        userId,
        file,
        privacyClass,
        sensitiveProcessingConsent: privacyClass === 'standard' ? false : sensitiveConsent,
      })
      replaceDocument(document)
      setFile(null)
      setPrivacyClass('')
      setSensitiveConsent(false)
      setMessage(document.error_code?.startsWith('SENSITIVE_')
        ? 'Arquivo salvo. A análise externa ficou bloqueada pela proteção de dados sensíveis.'
        : 'Documento analisado. Confira os dados antes de qualquer ação.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não consegui processar o arquivo.')
      setMessage('')
      await refresh()
    } finally {
      setUploading(false)
    }
  }

  async function retry(document: StaffDocument) {
    setWorking('retry')
    setError('')
    setMessage('Analisando novamente...')
    try {
      const updated = await analyzeDocument(document.id, document.external_processing_consent)
      replaceDocument(updated)
      setMessage('Nova análise concluída. Revise os dados.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não consegui analisar novamente.')
    } finally { setWorking('') }
  }

  async function saveReview(confirm = false) {
    if (!selected) return
    setWorking(confirm ? 'confirm' : 'save')
    setError('')
    try {
      const updates = draftUpdates(draft)
      const updated = confirm
        ? await confirmDocument(userId, selected, updates)
        : await updateDocumentReview(userId, selected.id, updates)
      replaceDocument(updated)
      setMessage(confirm ? 'Dados confirmados. As ações do Staff estão liberadas.' : 'Revisão salva.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não consegui salvar a revisão.')
    } finally { setWorking('') }
  }

  function requireConfirmed() {
    if (!selected) return false
    if (selected.status !== 'confirmed' && selected.status !== 'archived') {
      setError('Confirme os dados extraídos antes de executar esta ação.')
      return false
    }
    return true
  }

  async function expense() {
    if (!selected || !requireConfirmed()) return
    setWorking('expense'); setError('')
    try {
      const result = await registerExpenseFromDocument(userId, selected)
      setMessage(result.duplicate ? 'Essa despesa já estava registrada. Nenhum lançamento duplicado foi criado.' : 'Despesa registrada em Finanças.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui registrar a despesa.') }
    finally { setWorking('') }
  }

  async function reminder() {
    if (!selected || !requireConfirmed()) return
    setWorking('reminder'); setError('')
    try {
      const task = await onCreateTask(reminderFromDocument(selected))
      await recordReminderCreated(userId, selected, task.id)
      setMessage('Lembrete criado e integrado às notificações do Staff.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui criar o lembrete.') }
    finally { setWorking('') }
  }

  async function addEvent() {
    if (!selected || !requireConfirmed()) return
    setWorking('event'); setError('')
    try {
      const events = await onCreateEvent(eventFromDocument(selected))
      if (events[0]) await recordEventCreated(userId, selected, events[0].id)
      setMessage('Compromisso adicionado à Agenda do Staff.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui adicionar à Agenda.') }
    finally { setWorking('') }
  }

  async function memory() {
    if (!selected || !requireConfirmed()) return
    setWorking('memory'); setError('')
    try { await addDocumentToMemory(userId, selected); setMessage('Informações adicionadas à memória com a fonte documental.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui adicionar à memória.') }
    finally { setWorking('') }
  }

  async function archive() {
    if (!selected || !requireConfirmed()) return
    setWorking('archive'); setError('')
    try { const updated = await archiveDocument(userId, selected); replaceDocument(updated); setMessage('Documento arquivado no Smart Inbox.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui arquivar.') }
    finally { setWorking('') }
  }

  async function ignore() {
    if (!selected) return
    setWorking('ignore'); setError('')
    try { const updated = await ignoreDocument(userId, selected); replaceDocument(updated); setMessage('Documento marcado como ignorado.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui ignorar.') }
    finally { setWorking('') }
  }

  async function linkPerson() {
    if (!selected || !requireConfirmed()) return
    setWorking('person'); setError('')
    try { await linkDocumentToPerson(userId, selected, person); setPerson(''); setShowPerson(false); setMessage('Documento vinculado à pessoa informada.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui vincular a pessoa.') }
    finally { setWorking('') }
  }

  async function openOriginal() {
    if (!selected) return
    setWorking('open'); setError('')
    try {
      const url = await getSignedDocumentUrl(selected)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui abrir o original.') }
    finally { setWorking('') }
  }

  async function remove() {
    if (!selected || !window.confirm(`Excluir “${selected.title || selected.file_name}” e o arquivo privado?`)) return
    setWorking('delete'); setError('')
    try {
      await deleteDocument(userId, selected)
      const next = documents.filter((item) => item.id !== selected.id)
      setDocuments(next); setSelectedId(next[0]?.id || ''); setMessage('Documento excluído.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui excluir.') }
    finally { setWorking('') }
  }

  const filtered = useMemo(() => documents.filter((document) => {
    if (filter === 'review') return ['uploaded','processing','needs_review'].includes(document.status)
    if (filter === 'processed') return document.status === 'confirmed'
    if (filter === 'archived') return document.status === 'archived'
    if (filter === 'errors') return document.status === 'error'
    return document.status !== 'ignored'
  }), [documents, filter])

  const canExpense = selected && ['RECEIPT','INVOICE','BANK_RECEIPT'].includes(selected.document_type)
  const confirmed = selected && ['confirmed','archived'].includes(selected.status)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div><p className="text-purple-300 font-semibold">Staff Document Intelligence</p><h1 className="text-3xl md:text-4xl font-black text-white">Smart Inbox</h1><p className="text-slate-500 mt-2 max-w-2xl">Envie uma foto, PDF, recibo, nota, boleto ou documento. O Staff entende, organiza e sugere o próximo passo.</p></div>
        <button onClick={() => void refresh()} disabled={loading} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"><RefreshCw className={cn('inline w-4 h-4 mr-2', loading && 'animate-spin')} />Atualizar</button>
      </header>

      <section className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-slate-950/60 p-5 md:p-7">
        <div className="flex items-start gap-4"><div className="w-12 h-12 rounded-2xl bg-purple-500/15 grid place-items-center"><Inbox className="w-6 h-6 text-purple-300" /></div><div><h2 className="text-xl font-black">Novo documento</h2><p className="text-sm text-slate-500 mt-1">O arquivo fica privado. Ações financeiras só acontecem depois da sua revisão e confirmação.</p></div></div>
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <button onClick={() => cameraRef.current?.click()} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-left hover:border-purple-500/30"><Camera className="w-5 h-5 text-purple-300" /><p className="font-bold mt-2">Tirar foto</p><p className="text-xs text-slate-500 mt-1">Câmera traseira do aparelho</p></button>
          <button onClick={() => fileRef.current?.click()} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-left hover:border-purple-500/30"><Upload className="w-5 h-5 text-purple-300" /><p className="font-bold mt-2">Enviar arquivo</p><p className="text-xs text-slate-500 mt-1">Imagem, PDF, TXT, DOC ou DOCX · até 12 MB</p></button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf,text/plain,.doc,.docx" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
        </div>

        {file && <div className="mt-5 rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
          <div className="flex items-center gap-3"><FileText className="w-5 h-5 text-purple-300" /><div className="min-w-0 flex-1"><p className="font-bold truncate">{file.name}</p><p className="text-xs text-slate-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div><button onClick={() => chooseFile(null)} className="text-slate-600 hover:text-rose-300"><XCircle className="w-5 h-5" /></button></div>
          <p className="font-bold text-sm mt-5">Antes de analisar, que tipo de conteúdo é este?</p>
          <div className="grid sm:grid-cols-3 gap-2 mt-3">{[
            ['standard','Documento comum','Recibo, boleto, nota, contrato, garantia'],
            ['identity','Identidade','RG, CNH, passaporte ou documento pessoal'],
            ['medical','Saúde','Exame, laudo, receita ou documento médico'],
          ].map(([value, label, description]) => <label key={value} className={cn('rounded-xl border p-3 cursor-pointer', privacyClass === value ? 'border-purple-500/50 bg-purple-500/10' : 'border-slate-800 bg-slate-900/50')}><input type="radio" name="privacy" value={value} checked={privacyClass === value} onChange={() => { setPrivacyClass(value as StaffDocumentPrivacy); setSensitiveConsent(false) }} className="mr-2" /><span className="font-bold text-sm">{label}</span><p className="text-[11px] text-slate-500 mt-1 ml-5">{description}</p></label>)}</div>

          {privacyClass && privacyClass !== 'standard' && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-sm font-bold text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" />Proteção reforçada</p><p className="text-xs text-amber-100/60 mt-2">O Staff não envia identidade ou conteúdo médico a um provedor externo por padrão. Você pode apenas guardar o arquivo privado. Para pedir análise, é necessário consentimento explícito e o servidor também precisa ter sido habilitado para isso.</p><label className="flex gap-2 mt-3 text-xs text-slate-300"><input type="checkbox" checked={sensitiveConsent} onChange={(event) => setSensitiveConsent(event.target.checked)} /><span>Solicito a análise deste arquivo sensível e autorizo o processamento externo apenas se a configuração segura do Staff estiver habilitada.</span></label></div>}

          <button onClick={() => void processUpload()} disabled={!privacyClass || uploading} className="btn-purple mt-5 px-6 py-3 rounded-xl font-black disabled:opacity-35">{uploading ? <><Loader2 className="inline w-4 h-4 mr-2 animate-spin" />Processando...</> : <><Sparkles className="inline w-4 h-4 mr-2" />Enviar ao Smart Inbox</>}</button>
        </div>}
      </section>

      {(message || error) && <div className={cn('rounded-2xl border p-4 text-sm', error ? 'bg-rose-500/5 border-rose-500/20 text-rose-200' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200')}>{error || message}</div>}

      <section className="grid lg:grid-cols-[340px_1fr] gap-5">
        <aside className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 h-fit lg:sticky lg:top-24">
          <div className="flex items-center justify-between"><div><h2 className="font-black">Histórico</h2><p className="text-xs text-slate-600">{documents.length} documento{documents.length === 1 ? '' : 's'}</p></div>{loading && <Loader2 className="w-4 h-4 animate-spin text-purple-300" />}</div>
          <div className="flex gap-1.5 overflow-x-auto mt-4 pb-1">{([['all','Todos'],['review','Revisão'],['processed','Processados'],['archived','Arquivados'],['errors','Erros']] as Array<[FilterKey,string]>).map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={cn('px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap border', filter === key ? 'bg-purple-500/15 border-purple-500/30 text-purple-200' : 'bg-slate-900 border-slate-800 text-slate-500')}>{label}</button>)}</div>
          <div className="space-y-2 mt-3 max-h-[65vh] overflow-y-auto">{filtered.length ? filtered.map((document) => <button key={document.id} onClick={() => setSelectedId(document.id)} className={cn('w-full text-left rounded-2xl border p-3 transition-colors', selected?.id === document.id ? 'border-purple-500/35 bg-purple-500/10' : 'border-slate-800 bg-slate-900/50')}><div className="flex gap-2 justify-between"><p className="font-bold text-sm line-clamp-2">{document.title || document.file_name}</p>{document.duplicate_of && <span title="Possível duplicado" className="text-amber-300">≈</span>}</div><p className="text-xs text-purple-300 mt-1">{DOCUMENT_TYPE_LABELS[document.document_type]}</p><div className="flex items-center justify-between mt-2 gap-2"><span className={cn('text-[10px] px-2 py-1 rounded-lg border', statusTone(document.status))}>{statusLabel(document.status)}</span><span className="text-[10px] text-slate-600">{new Date(document.created_at).toLocaleDateString('pt-BR')}</span></div></button>) : <div className="p-6 text-center text-sm text-slate-600"><Inbox className="w-8 h-8 mx-auto mb-2" />Nada nesta categoria.</div>}</div>
        </aside>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-7 min-h-[520px]">
          {!selected ? <div className="min-h-[440px] grid place-items-center text-center"><div><FileSearch className="w-12 h-12 text-slate-700 mx-auto" /><h3 className="font-black text-xl mt-3">Mostre algo ao Staff</h3><p className="text-slate-600 mt-2">A análise e as ações aparecerão aqui.</p></div></div> : <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div><div className="flex flex-wrap gap-2"><span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200">{DOCUMENT_TYPE_LABELS[selected.document_type]}</span><span className={cn('text-xs px-2.5 py-1 rounded-lg border', statusTone(selected.status))}>{statusLabel(selected.status)}</span><span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-500">Privacidade: {privacyLabel(selected.privacy_class)}</span></div><h2 className="text-2xl font-black mt-3">{selected.title || selected.file_name}</h2><p className="text-xs text-slate-600 mt-1">Confiança: {selected.confidence === null ? 'não calculada' : `${Math.round(selected.confidence * 100)}%`} · {selected.provider ? `provedor ${selected.provider}` : 'sem processamento externo'}</p></div><div className="flex gap-2"><button onClick={() => void openOriginal()} disabled={working === 'open'} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300"><ExternalLink className="inline w-4 h-4 mr-1" />Original</button><button onClick={() => void remove()} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-600 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button></div></div>

            {selected.duplicate_of && <div className="mt-5 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20 text-sm text-amber-100"><AlertTriangle className="inline w-4 h-4 mr-2" />Este arquivo parece duplicar outro documento do Smart Inbox. O Staff também verifica duplicidade antes de criar uma despesa.</div>}
            {selected.error_message && <div className="mt-5 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-400">{selected.error_message}{selected.status === 'error' && <button onClick={() => void retry(selected)} className="ml-3 text-purple-300 font-bold"><RefreshCw className="inline w-3.5 h-3.5 mr-1" />Tentar novamente</button>}</div>}

            <div className="mt-6"><p className="text-sm font-black">Encontrei estas informações.</p><p className="text-xs text-slate-600 mt-1">Revise o que importa e confirme antes de agir.</p></div>
            <div className="grid md:grid-cols-2 gap-3 mt-4">
              <Field label="Tipo"><select value={draft.document_type} onChange={(e) => setDraft({ ...draft, document_type: e.target.value as StaffDocumentType })} className="field-input">{Object.entries(DOCUMENT_TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Título"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="field-input" /></Field>
              <Field label="Estabelecimento / emissor"><input value={draft.issuer} onChange={(e) => setDraft({ ...draft, issuer: e.target.value })} className="field-input" /></Field>
              <Field label="CNPJ/CPF do emissor"><input value={draft.issuer_document} onChange={(e) => setDraft({ ...draft, issuer_document: e.target.value })} className="field-input" /></Field>
              <Field label="Destinatário"><input value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} className="field-input" /></Field>
              <Field label="Número do documento"><input value={draft.document_number} onChange={(e) => setDraft({ ...draft, document_number: e.target.value })} className="field-input" /></Field>
              <Field label="Data"><input type="date" value={draft.issue_date} onChange={(e) => setDraft({ ...draft, issue_date: e.target.value })} className="field-input" /></Field>
              <Field label="Vencimento / prazo"><input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} className="field-input" /></Field>
              <Field label="Valor"><input inputMode="decimal" value={draft.total_amount} onChange={(e) => setDraft({ ...draft, total_amount: e.target.value })} placeholder="0,00" className="field-input" /></Field>
              <Field label="Moeda"><input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} maxLength={8} className="field-input" /></Field>
              <Field label="Forma de pagamento"><input value={draft.payment_method} onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })} className="field-input" /></Field>
              <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-4"><p className="text-xs text-slate-500">Valor reconhecido</p><p className="text-xl font-black mt-2">{formatMoney(selected.total_amount, selected.currency)}</p></div>
            </div>
            <Field label="Resumo"><textarea rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="field-input resize-y" /></Field>

            {selected.items?.length > 0 && <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"><summary className="cursor-pointer font-bold text-sm">Itens identificados ({selected.items.length})</summary><div className="mt-3 space-y-2">{selected.items.slice(0, 30).map((item,index) => <div key={index} className="text-xs text-slate-400 flex justify-between gap-3"><span>{String(item.description || `Item ${index + 1}`)}</span><span>{item.total === null || item.total === undefined ? '' : formatMoney(Number(item.total), selected.currency)}</span></div>)}</div></details>}
            {selected.obligations?.length > 0 && <details className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"><summary className="cursor-pointer font-bold text-sm">Obrigações e prazos ({selected.obligations.length})</summary><div className="mt-3 space-y-2">{selected.obligations.slice(0, 30).map((item,index) => <p key={index} className="text-xs text-slate-400">• {String(item.description || 'Obrigação')} {item.dueDate ? `— ${String(item.dueDate)}` : ''}</p>)}</div></details>}
            {selected.raw_text && <details className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"><summary className="cursor-pointer font-bold text-sm">Texto reconhecido</summary><p className="mt-3 text-xs text-slate-500 whitespace-pre-wrap max-h-64 overflow-y-auto">{selected.raw_text}</p></details>}

            <div className="flex flex-wrap gap-2 mt-6"><button onClick={() => void saveReview(false)} disabled={Boolean(working)} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold"><Save className="inline w-4 h-4 mr-2" />Salvar revisão</button><button onClick={() => void saveReview(true)} disabled={Boolean(working)} className="btn-purple px-5 py-2.5 rounded-xl text-sm font-black"><CheckCircle2 className="inline w-4 h-4 mr-2" />{confirmed ? 'Confirmar novamente' : 'Confirmar dados'}</button></div>

            <div className="mt-8 pt-6 border-t border-slate-800"><h3 className="font-black">Ações sugeridas</h3><p className="text-xs text-slate-600 mt-1">Nada financeiro é executado automaticamente.</p><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-4">
              {canExpense && <ActionButton icon={CircleDollarSign} label="Registrar despesa" disabled={!confirmed || Boolean(working)} onClick={() => void expense()} />}
              {selected.due_date && <ActionButton icon={Clock3} label="Criar lembrete" disabled={!confirmed || Boolean(working)} onClick={() => void reminder()} />}
              <ActionButton icon={Archive} label="Salvar documento" disabled={!confirmed || Boolean(working)} onClick={() => void archive()} />
              <ActionButton icon={Sparkles} label="Adicionar à memória" disabled={!confirmed || Boolean(working)} onClick={() => void memory()} />
              <ActionButton icon={UserRoundPlus} label="Vincular a uma pessoa" disabled={!confirmed || Boolean(working)} onClick={() => setShowPerson(true)} />
              {(selected.due_date || selected.issue_date) && <ActionButton icon={CalendarPlus} label="Adicionar compromisso" disabled={!confirmed || Boolean(working)} onClick={() => void addEvent()} />}
              <ActionButton icon={XCircle} label="Ignorar" disabled={Boolean(working)} onClick={() => void ignore()} />
            </div>
            {showPerson && <div className="flex flex-col sm:flex-row gap-2 mt-3"><input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Nome ou identificação da pessoa" className="field-input flex-1" /><button onClick={() => void linkPerson()} disabled={!person.trim() || working === 'person'} className="btn-purple px-5 py-3 rounded-xl font-bold"><Link2 className="inline w-4 h-4 mr-2" />Vincular</button></div>}
            {confirmed && <button onClick={() => onNavigate('finance')} className="mt-4 text-sm text-purple-300 hover:text-purple-200">Abrir Finanças →</button>}
            </div>
          </>}
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mt-3"><span className="text-[11px] uppercase tracking-wide font-bold text-slate-600">{label}</span>{children}</label>
}

function ActionButton({ icon: Icon, label, disabled, onClick }: { icon: typeof Check; label: string; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-left text-sm font-bold text-slate-300 hover:border-purple-500/30 disabled:opacity-35"><Icon className="inline w-4 h-4 mr-2 text-purple-300" />{label}</button>
}
