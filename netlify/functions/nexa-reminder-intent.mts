type ReminderIntentPayload = {
  user?: { id?: string; displayName?: string }
  message?: string
  timezone?: string
}

type ReminderAction = {
  type: 'schedule_local_reminder'
  title: string
  body: string
  at: string
  timezone: string
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

function safeTimezone(value: unknown) {
  const timezone = String(value || '').trim()
  return timezone === 'America/Sao_Paulo' ? timezone : 'America/Sao_Paulo'
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength)
}

function validateAction(value: any, timezone: string): ReminderAction | null {
  if (!value || value.type !== 'schedule_local_reminder') return null

  const title = cleanText(value.title, 100)
  const body = cleanText(value.body, 240)
  const at = cleanText(value.at, 64)
  const timestamp = Date.parse(at)

  if (!title || !body || !at || !Number.isFinite(timestamp)) return null

  const now = Date.now()
  const maxFuture = now + 1000 * 60 * 60 * 24 * 366 * 5
  if (timestamp <= now + 15_000 || timestamp > maxFuture) return null

  return {
    type: 'schedule_local_reminder',
    title,
    body,
    at: new Date(timestamp).toISOString(),
    timezone,
  }
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const serviceKey = env('STAFF_NEXA_SERVICE_KEY')
  if (!serviceKey) return json({ error: 'nexa_bridge_not_configured' }, 503)

  const supplied = bearer(request)
  if (!supplied || supplied !== serviceKey) return json({ error: 'unauthorized' }, 401)

  const headerUserId = cleanText(request.headers.get('x-nexa-user-id'), 160)
  if (!headerUserId) return json({ error: 'nexa_user_required' }, 400)

  let payload: ReminderIntentPayload
  try {
    payload = await request.json() as ReminderIntentPayload
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const payloadUserId = cleanText(payload.user?.id, 160)
  if (!payloadUserId || payloadUserId !== headerUserId) {
    return json({ error: 'nexa_user_mismatch' }, 403)
  }

  const message = cleanText(payload.message, 4000)
  if (!message) return json({ error: 'message_required' }, 400)

  const timezone = safeTimezone(payload.timezone)
  const openaiKey = env('OPENAI_API_KEY')
  if (!openaiKey) return json({ error: 'openai_not_configured' }, 503)

  const model = env('OPENAI_STAFF_NEXA_MODEL') || env('OPENAI_STAFF_MODEL') || 'gpt-4o-mini'
  const nowIso = new Date().toISOString()

  const system = `Você é um classificador de intenção de lembrete para o Assistente Nexa.

Sua única função é detectar quando o usuário EXPLICITAMENTE pede para ser lembrado ou avisado em um momento futuro.

Agora (UTC): ${nowIso}
Fuso principal do usuário: ${timezone}

Retorne SOMENTE JSON válido neste formato:
{"action":null}
OU
{"action":{"type":"schedule_local_reminder","title":"...","body":"...","at":"ISO-8601 com offset"}}

REGRAS:
- Só crie action quando houver intenção explícita de lembrete/aviso E data/hora suficientemente determinada.
- Entenda expressões como hoje, amanhã, depois de amanhã, segunda-feira, às 9, em 30 minutos, daqui a 2 horas.
- Se faltar informação essencial de data/hora, retorne action null; não invente.
- Não crie ação para planejamento genérico, listas, metas, perguntas ou informação financeira.
- Não execute pagamento, Pix, transferência, compra, venda ou qualquer movimentação financeira.
- title deve ter no máximo 100 caracteres e body no máximo 240.
- at deve representar um instante FUTURO e respeitar o fuso ${timezone}.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openaiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error(
        'nexa-reminder-intent provider error',
        response.status,
        String(result?.error?.code || result?.error?.type || 'unknown').slice(0, 80),
      )
      return json({ ok: true, action: null, degraded: true })
    }

    const raw = String(result?.choices?.[0]?.message?.content || '').trim()
    let parsed: any = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      return json({ ok: true, action: null, degraded: true })
    }

    return json({
      ok: true,
      action: validateAction(parsed?.action, timezone),
      persistence: 'device_local_only',
      financialExecution: false,
    })
  } catch (error) {
    console.error(
      'nexa-reminder-intent error',
      error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    )
    return json({ ok: true, action: null, degraded: true })
  }
}
