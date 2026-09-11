import { normalizeDocumentExtraction } from './document-core.mjs'

export type DocumentProviderInput = {
  fileName: string
  mimeType: string
  fileBase64: string
  privacyClass: 'standard' | 'identity' | 'medical'
}

export interface DocumentExtractionProvider {
  name: string
  external: boolean
  extract(input: DocumentProviderInput): Promise<Record<string, unknown>>
}

const documentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'documentType', 'title', 'issuer', 'issuerDocument', 'recipient', 'documentNumber',
    'issueDate', 'dueDate', 'totalAmount', 'currency', 'paymentMethod', 'items', 'parties',
    'obligations', 'summary', 'rawText', 'confidence', 'metadata',
  ],
  properties: {
    documentType: {
      type: 'string',
      enum: ['RECEIPT','INVOICE','BILL','BANK_RECEIPT','CONTRACT','WARRANTY','IDENTITY_DOCUMENT','MEDICAL_DOCUMENT','OTHER'],
    },
    title: { type: ['string','null'] },
    issuer: { type: ['string','null'] },
    issuerDocument: { type: ['string','null'] },
    recipient: { type: ['string','null'] },
    documentNumber: { type: ['string','null'] },
    issueDate: { type: ['string','null'], description: 'YYYY-MM-DD quando claramente identificável.' },
    dueDate: { type: ['string','null'], description: 'YYYY-MM-DD quando claramente identificável.' },
    totalAmount: { type: ['number','null'] },
    currency: { type: 'string' },
    paymentMethod: { type: ['string','null'] },
    items: {
      type: 'array', maxItems: 80,
      items: {
        type: 'object', additionalProperties: false,
        required: ['description','quantity','unitPrice','total'],
        properties: {
          description: { type: ['string','null'] },
          quantity: { type: ['number','null'] },
          unitPrice: { type: ['number','null'] },
          total: { type: ['number','null'] },
        },
      },
    },
    parties: {
      type: 'array', maxItems: 40,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name','role','document'],
        properties: {
          name: { type: ['string','null'] }, role: { type: ['string','null'] }, document: { type: ['string','null'] },
        },
      },
    },
    obligations: {
      type: 'array', maxItems: 50,
      items: {
        type: 'object', additionalProperties: false,
        required: ['description','dueDate','importance'],
        properties: {
          description: { type: ['string','null'] }, dueDate: { type: ['string','null'] }, importance: { type: ['string','null'] },
        },
      },
    },
    summary: { type: ['string','null'] },
    rawText: { type: ['string','null'] },
    confidence: { type: ['number','null'], minimum: 0, maximum: 1 },
    metadata: {
      type: 'object', additionalProperties: false,
      required: ['barcode','notes'],
      properties: { barcode: { type: ['string','null'] }, notes: { type: ['string','null'] } },
    },
  },
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue
    for (const content of item.content || []) {
      if (content?.type === 'output_text' && content.text) return content.text
    }
  }
  return ''
}

export class InternalAIProvider implements DocumentExtractionProvider {
  name = 'internal_ai'
  external = true

  constructor(private apiKey: string, private model: string) {}

  async extract(input: DocumentProviderInput) {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY ausente.')

    const instructions = [
      'Você é o motor de Document Intelligence do Staff.',
      'Extraia APENAS informações sustentadas pelo arquivo; nunca invente valores, datas, pessoas, números ou itens.',
      'Classifique em RECEIPT, INVOICE, BILL, BANK_RECEIPT, CONTRACT, WARRANTY, IDENTITY_DOCUMENT, MEDICAL_DOCUMENT ou OTHER.',
      'Use null quando um campo não estiver claro. Datas devem ser YYYY-MM-DD.',
      'totalAmount deve representar o total principal do documento, não uma parcela aleatória.',
      'Para contratos e garantias, registre obrigações e prazos relevantes em obligations.',
      'Para notas/recibos, extraia itens quando legíveis, sem inferir itens ocultos.',
      'rawText deve conter apenas o texto útil reconhecido, sem comentários do modelo.',
      'confidence é uma estimativa global de 0 a 1 baseada em legibilidade e clareza.',
      'Não tome nenhuma ação financeira. Apenas extraia e estruture para revisão do usuário.',
      'Responda somente no schema solicitado.',
    ].join('\n')

    const fileContent = input.mimeType.startsWith('image/')
      ? { type: 'input_image', image_url: `data:${input.mimeType};base64,${input.fileBase64}`, detail: 'high' }
      : { type: 'input_file', filename: input.fileName, file_data: `data:${input.mimeType};base64,${input.fileBase64}` }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: instructions }, fileContent] }],
        text: { format: { type: 'json_schema', name: 'staff_document', strict: true, schema: documentSchema } },
        max_output_tokens: 6500,
      }),
    })

    if (!response.ok) throw new Error(`internal_ai_http_${response.status}`)
    const body = await response.json()
    const output = extractOutputText(body)
    if (!output) throw new Error('internal_ai_empty_output')
    try {
      return JSON.parse(output)
    } catch {
      throw new Error('internal_ai_invalid_json')
    }
  }
}

export class MockProvider implements DocumentExtractionProvider {
  name = 'mock'
  external = false

  async extract(input: DocumentProviderInput) {
    return normalizeDocumentExtraction({
      documentType: 'OTHER',
      title: `Documento de teste — ${input.fileName}`,
      issuer: null,
      issuerDocument: null,
      recipient: null,
      documentNumber: null,
      issueDate: null,
      dueDate: null,
      totalAmount: null,
      currency: 'BRL',
      paymentMethod: null,
      items: [], parties: [], obligations: [],
      summary: 'Documento processado pelo MockProvider para desenvolvimento e testes.',
      rawText: null,
      confidence: 0.5,
      metadata: { mock: true },
    }) as unknown as Record<string, unknown>
  }
}

export class DocStructProvider implements DocumentExtractionProvider {
  name = 'docstruct'
  external = true

  constructor(private endpoint: string, private apiKey: string) {}

  async extract(input: DocumentProviderInput) {
    if (!this.endpoint || !this.apiKey) throw new Error('docstruct_not_configured')
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: input.fileName,
        mime_type: input.mimeType,
        file_base64: input.fileBase64,
        schema: 'staff_document_v1',
      }),
    })
    if (!response.ok) throw new Error(`docstruct_http_${response.status}`)
    const body = await response.json()
    return (body?.document || body?.extraction || body) as Record<string, unknown>
  }
}

export function resolveDocumentProvider(env = process.env): DocumentExtractionProvider {
  const provider = String(env.STAFF_DOCUMENT_PROVIDER || 'internal_ai').trim().toLowerCase()
  if (provider === 'mock') return new MockProvider()
  if (provider === 'docstruct') return new DocStructProvider(String(env.DOCSTRUCT_API_URL || ''), String(env.DOCSTRUCT_API_KEY || ''))
  return new InternalAIProvider(
    String(env.OPENAI_API_KEY || ''),
    String(env.OPENAI_DOCUMENT_MODEL || env.OPENAI_STUDY_MODEL || 'gpt-5-mini'),
  )
}
