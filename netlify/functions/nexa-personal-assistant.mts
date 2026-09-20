import {
  NEXA_KNOWLEDGE,
  NEXA_KNOWLEDGE_VERSION,
} from './_shared/nexa-knowledge.mts'

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
  user?: { id?: string; displayName?: string; email?: string }
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

function env(name: string) {
  try {
    return String(Netlify.env.get(name) || '').trim()
  } catch {
    return String(process.env[name] || '').trim()
  }
}

function bearer(request: Request) {
  const auth = request.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function safeHistory(value: NexaAssistantPayload['conversationHistory']) {
  if (!Array.isArray(value)) return []
  return value
    .slice(-12)
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
  const secret = env('STAFF_NEXA_SERVICE_KEY')
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
      bridgeVersion: 'nexa-personal-v3',
      knowledgeVersion: NEXA_KNOWLEDGE_VERSION,
      brandSurface: 'nexa',
      engine: 'staff',
      memoryMode: 'progressive_federation',
      financialContext: 'read_only',
      paymentPreparation: true,
      paymentExecution: false,
      capabilities: [
        'conversation',
        'voice_ready',
        'life_support',
        'daily_planning',
        'priorities',
        'goals',
        'family_support',
        'study_support',
        'work_support',
        'nexa_product_knowledge',
        'nexa_support_knowledge',
        'financial_context_reasoning',
        'next_step_structuring',
      ],
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

  const openaiKey = env('OPENAI_API_KEY')
  if (!openaiKey) return json({ error: 'openai_not_configured' }, 503)
  const model = env('OPENAI_STAFF_NEXA_MODEL') || env('OPENAI_STAFF_MODEL') || 'gpt-4o-mini'

  const financial = compactFinancialContext(payload.context?.financial)
  const displayName = String(payload.user?.displayName || '').trim().slice(0, 120) || 'cliente Nexa'

  const system = `Você é o Assistente Nexa, um assistente pessoal inteligente para a vida cotidiana integrado ao aplicativo Nexa. O motor interno reutiliza capacidades do Staff, mas para o usuário você faz parte da Nexa.

USUÁRIO: ${displayName}.

MISSÃO:
- Ajudar a pessoa no dia a dia, não apenas com dinheiro.
- Apoiar rotina, prioridades, planejamento do dia e da semana, tarefas, estudos, família, casa, trabalho, metas, viagens, documentos comuns, organização pessoal e tomada de decisões cotidianas.
- Quando houver contexto financeiro autorizado, conectar dinheiro e vida de forma útil: compromissos, orçamento, próximos pagamentos e organização financeira.
- Ser uma interface simples para futuras capacidades de agenda, lembretes, Smart Inbox e automações.
- Conhecer a Nexa profundamente e responder dúvidas sobre o produto de forma simples, precisa e coerente com a marca.

BASE CANÔNICA DA NEXA (versão ${NEXA_KNOWLEDGE_VERSION}):
${NEXA_KNOWLEDGE}

CONTEXTO FINANCEIRO AUTORIZADO DA NEXA (somente leitura; dados de runtime prevalecem sobre a base estática):
${JSON.stringify(financial)}

REGRAS DE VERACIDADE E PRIVACIDADE:
- Não invente saldo, transação, compromisso, memória, documento, tarefa ou evento.
- Se uma informação pessoal não estiver no contexto, diga que ainda não a conhece e ajude mesmo assim com orientação geral.
- Se uma funcionalidade da Nexa não estiver confirmada pelo runtime e a base disser que ela está em rollout/visão futura, não a apresente como disponível agora.
- Memória persistente, agenda e Smart Inbox estão em federação progressiva. Não afirme que salvou, agendou ou lembrou algo enquanto a ação não tiver confirmação explícita do sistema.
- Nunca exponha IDs internos, metadados de provider, referências técnicas, credenciais, flags ou arquitetura interna sensível.
- Não use dados financeiros, conversas, voz, família, saúde ou documentos para publicidade ou segmentação.

SEGURANÇA FINANCEIRA:
- Você pode explicar saldos e movimentações e PREPARAR a intenção de um pagamento, Pix, transferência, compra ou venda.
- Nunca afirme que executou uma movimentação financeira. Toda execução pertence ao core Nexa e exige confirmação própria na interface.

ESTILO:
- Português brasileiro.
- Natural, acolhedor sem ser excessivamente informal.
- Direto, prático e útil.
- Sobre a Nexa, explique primeiro em linguagem simples e só aprofunde infraestrutura quando o usuário pedir.
- Quando a pessoa pedir ajuda para organizar algo, ofereça um plano simples e acionável.
- Quando fizer sentido, conecte contexto de vida + contexto financeiro, sem transformar toda conversa em assunto de dinheiro.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openaiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
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
      console.error(
        'nexa-personal-assistant provider error',
        response.status,
        String(result?.error?.code || result?.error?.type || 'unknown').slice(0, 80),
      )
      return json({ error: 'assistant_provider_failed' }, 502)
    }

    const content = String(result?.choices?.[0]?.message?.content || '').trim()
    if (!content) return json({ error: 'empty_assistant_response' }, 502)

    return json({
      ok: true,
      response: content,
      bridgeVersion: 'nexa-personal-v3',
      knowledgeVersion: NEXA_KNOWLEDGE_VERSION,
      brandSurface: 'nexa',
      engine: 'staff',
      memoryMode: 'progressive_federation',
      financialContext: 'read_only',
      paymentPreparation: true,
      paymentExecution: false,
      capabilities: [
        'conversation',
        'voice_ready',
        'life_support',
        'daily_planning',
        'nexa_product_knowledge',
        'nexa_support_knowledge',
        'financial_context_reasoning',
      ],
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
