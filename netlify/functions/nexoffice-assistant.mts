type BusinessContext = {
  workspace?: { id?: string; name?: string }
  pulse?: Record<string, unknown>
  priorities?: unknown[]
  facts?: Record<string, unknown>
}

type AssistantPayload = {
  message?: string
  agentRole?: string | null
  conversationHistory?: Array<{ role?: string; content?: string }>
  context?: BusinessContext
  correlationId?: string
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

function safeHistory(value: AssistantPayload['conversationHistory']) {
  if (!Array.isArray(value)) return []
  return value
    .slice(-12)
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .map((item) => ({ role: item.role as 'user' | 'assistant', content: String(item.content).slice(0, 6000) }))
}

function compactContext(value: BusinessContext | undefined) {
  const context = value && typeof value === 'object' ? value : {}
  return {
    workspace: context.workspace ? {
      id: String(context.workspace.id || '').slice(0, 80),
      name: String(context.workspace.name || '').slice(0, 160),
    } : undefined,
    pulse: context.pulse && typeof context.pulse === 'object' ? context.pulse : {},
    priorities: Array.isArray(context.priorities) ? context.priorities.slice(0, 12) : [],
    facts: context.facts && typeof context.facts === 'object' ? context.facts : {},
  }
}

export default async (request: Request) => {
  const secret = String(process.env.STAFF_NEXOFFICE_SERVICE_KEY || '').trim()
  if (!secret) return json({ error: 'staff_nexoffice_bridge_not_configured' }, 503)

  const supplied = bearer(request)
  if (!supplied || supplied !== secret) return json({ error: 'unauthorized' }, 401)

  const workspaceId = String(request.headers.get('x-nexoffice-workspace-id') || '').trim()
  if (!workspaceId) return json({ error: 'workspace_required' }, 400)

  if (request.method === 'GET') {
    return json({
      ok: true,
      status: 'connected',
      service: 'staff-nexoffice-assistant',
      privacyMode: 'workspace_context_only',
      personalMemoryAccess: false,
      externalActions: false,
      capabilities: ['conversation', 'context_reasoning', 'next_step_structuring'],
    })
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let payload: AssistantPayload
  try {
    payload = await request.json() as AssistantPayload
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const message = String(payload.message || '').trim()
  if (!message) return json({ error: 'message_required' }, 400)
  if (message.length > 10000) return json({ error: 'message_too_long' }, 400)

  const context = compactContext(payload.context)
  if (context.workspace?.id && context.workspace.id !== workspaceId) {
    return json({ error: 'workspace_mismatch' }, 403)
  }

  const openaiKey = String(process.env.OPENAI_API_KEY || '')
  if (!openaiKey) return json({ error: 'openai_not_configured' }, 503)
  const model = String(process.env.OPENAI_STAFF_NEXOFFICE_MODEL || process.env.OPENAI_STAFF_MODEL || 'gpt-4o-mini')

  const system = `Você é o Staff Business, engine conversacional do NexOffice para operação empresarial.\n\nREGRAS DE ISOLAMENTO:\n- Você recebe somente contexto do workspace NexOffice enviado nesta requisição.\n- Você NÃO tem acesso e NÃO deve pedir acesso às memórias pessoais, documentos pessoais, saúde, família, finanças pessoais ou Smart Inbox do usuário do Staff.\n- Nunca misture contexto pessoal do Staff com contexto empresarial do NexOffice.\n- Não invente fatos ausentes no contexto.\n- Quando faltar um dado operacional, diga claramente que ele não veio no contexto do workspace.\n- Não execute pagamento, assinatura, mensagem, publicação ou outra ação externa; apenas responda, organize, sugira e estruture próximos passos. A execução e aprovações pertencem ao NexOffice Core.\n- Responda em português brasileiro, de forma clara, executiva e prática.\n\nWorkspace: ${JSON.stringify(context.workspace || { id: workspaceId })}\nPulso operacional: ${JSON.stringify(context.pulse)}\nPrioridades: ${JSON.stringify(context.priorities)}\nFatos adicionais permitidos: ${JSON.stringify(context.facts)}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' },
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
      console.error('nexoffice-assistant OpenAI error', response.status)
      return json({ error: 'assistant_provider_failed' }, 502)
    }

    const content = String(result?.choices?.[0]?.message?.content || '').trim()
    if (!content) return json({ error: 'empty_assistant_response' }, 502)

    return json({
      ok: true,
      response: content,
      agentRole: payload.agentRole || 'controller',
      workspaceId,
      correlationId: payload.correlationId || null,
      privacyMode: 'workspace_context_only',
      personalMemoryAccess: false,
      externalActions: false,
      usage: result?.usage ? {
        promptTokens: Number(result.usage.prompt_tokens || 0),
        completionTokens: Number(result.usage.completion_tokens || 0),
        totalTokens: Number(result.usage.total_tokens || 0),
      } : null,
    })
  } catch (error) {
    console.error('nexoffice-assistant error', error instanceof Error ? error.message.slice(0, 160) : 'unknown')
    return json({ error: 'assistant_unavailable' }, 502)
  }
}