type FinancialTransaction = {
  type?: string
  asset?: string
  direction?: string
  amount?: number
  status?: string
  description?: string | null
  createdAt?: string
}

type NexaContext = {
  financial?: {
    source?: string
    mode?: string
    balances?: Record<string, number>
    recentTransactions?: FinancialTransaction[]
    metadataIncluded?: boolean
    providerReferencesIncluded?: boolean
  }
}

type NexaAssistantPayload = {
  mode?: string
  user?: { id?: string; displayName?: string }
  message?: string
  conversationHistory?: Array<{ role?: string; content?: string }>
  context?: NexaContext
  scopes?: string[]
  safety?: {
    financialExecution?: boolean
    paymentPreparationOnly?: boolean
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

function bearer(request: Request) {
  const auth = request.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function safeHistory(value: NexaAssistantPayload['conversationHistory']) {
  if (!Array.isArray(value)) return []
  return value
    .slice(-10)
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: String(item.content).trim().slice(0, 8000),
    }))
    .filter((item) => item.content.length > 0)
}

function compactFinancialContext(value: NexaContext['financial']) {
  const financial = value && typeof value === 'object' ? value : {}
  const balances = financial.balances && typeof financial.balances === 'object'
    ? Object.fromEntries(
        Object.entries(financial.balances)
          .slice(0, 12)
          .map(([asset, amount]) => [String(asset).slice(0, 20), Number(amount || 0)]),
      )
    : {}

  const recentTransactions = Array.isArray(financial.recentTransactions)
    ? financial.recentTransactions.slice(0, 20).map((item) => ({
        type: String(item?.type || '').slice(0, 80),
        asset: String(item?.asset || '').slice(0, 20),
        direction: String(item?.direction || '').slice(0, 20),
        amount: Number(item?.amount || 0),
        status: String(item?.status || '').slice(0, 40),
        description: item?.description ? String(item.description).slice(0, 180) : null,
        createdAt: item?.createdAt ? String(item.createdAt).slice(0, 40) : null,
      }))
    : []

  return {
    source: String(financial.source || 'nexa_ledger').slice(0, 50),
    mode: String(financial.mode || 'portfolio').slice(0, 40),
    balances,
    recentTransactions,
    metadataIncluded: false,
    providerReferencesIncluded: false,
  }
}

export default async (request: Request) => {
  const secret = String(process.env.STAFF_NEXA_SERVICE_KEY || '').trim()
  if (!secret) return json({ error: 'nexa_bridge_not_configured' }, 503)

  const supplied = bearer(request)
  if (!supplied || supplied !== secret) return json({ error: 'unauthorized' }, 401)

  const headerUserId = String(request.headers.get('x-nexa-user-id') || '').trim()
  if (!headerUserId) return json({ error: 'nexa_user_required' }, 400)

  if (request.method === 'GET') {
    return json({
      ok: true,
      status: 'connected',
      service: 'nexa-personal-assistant',
      bridgeVersion: 'nexa-personal-v1',
      brandSurface: 'nexa',
      engine: 'staff',
      memoryMode: 'not_connected',
      financialContext: 'read_only',
      paymentPreparation: true,
      paymentExecution: false,
      capabilities: ['conversation', 'financial_context_reasoning', 'next_step_structuring'],
    })
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let payload: NexaAssistantPayload
  try {
    payload = await request.json() as NexaAssistantPayload
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const payloadUserId = String(payload.user?.id || '').trim()
  if (!payloadUserId || payloadUserId !== headerUserId) {
    return json({ error: 'nexa_user_mismatch' }, 403)
  }

  const message = String(payload.message || '').trim()
  if (!message) return json({ error: 'message_required' }, 400)
  if (message.length > 12000) return json({ error: 'message_too_long' }, 400)

  if (payload.safety?.financialExecution !== false) {
    return json({ error: 'unsafe_financial_execution_contract' }, 400)
  }

  const allowedScopes = new Set([
    'staff.tasks.read',
    'staff.tasks.write',
    'staff.calendar.read',
    'staff.calendar.write',
    'staff.memory.read',
    'staff.memory.write',
    'staff.documents.read_structured',
    'nexa.balance.read',
    'nexa.transactions.read',
    'nexa.payment.prepare',
  ])
  const requestedScopes = Array.isArray(payload.scopes) ? payload.scopes : []
  if (requestedScopes.some((scope) => !allowedScopes.has(String(scope)))) {
    return json({ error: 'unsupported_scope' }, 403)
  }

  const openaiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!openaiKey) return json({ error: 'openai_not_configured' }, 503)
  const model = String(
    process.env.OPENAI_STAFF_NEXA_MODEL ||
    process.env.OPENAI_STAFF_MODEL ||
    'gpt-4o-mini',
  )

  const financial = compactFinancialContext(payload.context?.financial)
  const displayName = String(payload.user?.displayName || '').trim().slice(0, 120) || 'cliente Nexa'

  const system = `Você é o assistente pessoal inteligente integrado ao aplicativo Nexa.\n\nIDENTIDADE DE PRODUTO:\n- Para o usuário, você faz parte da experiência Nexa. Não apresente a marca interna Staff nem diga que o usuário saiu da Nexa.\n- O motor interno pode ser reutilizado de outros produtos da Alternative Ventures, mas isso não deve criar fricção ou login adicional.\n\nUSUÁRIO: ${displayName}.\n\nCONTEXTO FINANCEIRO AUTORIZADO DA NEXA (somente leitura):\n${JSON.stringify(financial)}\n\nREGRAS DE SEGURANÇA:\n- Você pode explicar saldos e movimentações, ajudar a organizar o dia, estruturar lembretes e sugerir próximos passos.\n- Você pode PREPARAR a intenção de um pagamento, Pix, transferência, compra ou venda, mas nunca afirmar que executou uma movimentação.\n- Toda execução financeira pertence ao core Nexa e exige confirmação própria na interface.\n- Não invente saldo, transação, compromisso, memória ou documento.\n- Se o contexto não trouxer um dado, diga claramente que ele não está disponível.\n- Não exponha IDs internos, metadados de provider ou referências técnicas.\n- Não use dados financeiros para publicidade, persuasão comercial ou segmentação nesta conversa.\n- Responda em português brasileiro, de forma útil, direta e natural.\n\nESTADO DE CAPABILITIES:\n- conversa e raciocínio financeiro: disponíveis;\n- memória pessoal persistente/agenda/Smart Inbox via federation: em integração progressiva; não finja que persistiu algo enquanto memoryMode estiver not_connected;\n- execução financeira por IA: proibida.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openaiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: system },
          ...safeHistory(payload.conversationHistory),
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('nexa-personal-assistant OpenAI error', response.status)
      return json({ error: 'assistant_provider_failed' }, 502)
    }

    const content = String(result?.choices?.[0]?.message?.content || '').trim()
    if (!content) return json({ error: 'empty_assistant_response' }, 502)

    return json({
      ok: true,
      response: content,
      bridgeVersion: 'nexa-personal-v1',
      brandSurface: 'nexa',
      engine: 'staff',
      memoryMode: 'not_connected',
      financialContext: 'read_only',
      paymentPreparation: true,
      paymentExecution: false,
      usage: result?.usage ? {
        promptTokens: Number(result.usage.prompt_tokens || 0),
        completionTokens: Number(result.usage.completion_tokens || 0),
        totalTokens: Number(result.usage.total_tokens || 0),
      } : null,
    })
  } catch (error) {
    console.error(
      'nexa-personal-assistant error',
      error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    )
    return json({ error: 'assistant_unavailable' }, 502)
  }
}
