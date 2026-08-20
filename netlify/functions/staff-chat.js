const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'X-Staff-Backend': 'public-v2',
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

function safeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .slice(-10)
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.slice(0, 12000) }))
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return response(405, { error: 'Método não permitido.' })

  try {
    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
    const backendSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
    const openaiKey = process.env.OPENAI_API_KEY || ''
    const model = process.env.OPENAI_STAFF_MODEL || 'gpt-4o-mini'

    if (!supabaseUrl || !backendSecret || !openaiKey) {
      return response(500, { error: 'Staff backend não configurado.' })
    }

    const authorization = event.headers?.authorization || event.headers?.Authorization || ''
    if (!authorization.startsWith('Bearer ')) {
      return response(401, { error: 'Sessão obrigatória.', response: 'Sua sessão expirou. Entre novamente no Staff com seu e-mail e senha.' })
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: backendSecret, Authorization: authorization },
    })
    if (!authResponse.ok) {
      return response(401, { error: 'Sessão inválida.', response: 'Sua sessão expirou. Entre novamente no Staff com seu e-mail e senha.' })
    }
    const authUser = await authResponse.json()
    if (!authUser?.id) return response(401, { error: 'Sessão inválida.' })

    const payload = JSON.parse(event.body || '{}')
    const cleanMessage = String(payload.message || '').trim()
    if (!cleanMessage) return response(400, { error: 'Mensagem obrigatória.' })

    const finalUserId = authUser.id
    const displayName = authUser.user_metadata?.name || authUser.email?.split('@')?.[0] || 'usuário'

    async function saveMemory(memoryText) {
      if (!memoryText) return false
      const result = await fetch(`${supabaseUrl}/rest/v1/staff_memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: backendSecret,
          Authorization: `Bearer ${backendSecret}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ user_id: finalUserId, category: 'pessoal', content: memoryText, importance: 2, user_confirmed: true }),
      })
      if (!result.ok) console.error('Staff memory save warning:', (await result.text()).slice(0, 400))
      return result.ok
    }

    async function getMemories() {
      const url = `${supabaseUrl}/rest/v1/staff_memories?user_id=eq.${encodeURIComponent(finalUserId)}&archived=eq.false&select=category,content,created_at&order=created_at.desc&limit=30`
      const result = await fetch(url, { headers: { apikey: backendSecret, Authorization: `Bearer ${backendSecret}` } })
      if (!result.ok) {
        console.error('Staff memory read warning:', (await result.text()).slice(0, 400))
        return []
      }
      return result.json()
    }

    if (cleanMessage.toLowerCase().startsWith('lembrar:')) {
      const memoryText = cleanMessage.replace(/lembrar:/i, '').trim()
      if (!memoryText) return response(400, { response: 'Me diga o que devo lembrar. Exemplo: lembrar: prefiro reuniões pela manhã.' })
      const saved = await saveMemory(memoryText)
      return response(200, {
        response: saved ? `Perfeito. Vou lembrar disso: ${memoryText}` : 'Entendi. Não consegui salvar essa memória agora, mas você pode tentar novamente em instantes.',
        timestamp: new Date().toISOString(),
      })
    }

    const memories = await getMemories()
    const memoryText = memories.length ? memories.map((item) => `- ${item.content}`).join('\n') : 'Nenhuma memória salva ainda.'

    const systemPrompt = `Você é o Staff, assistente pessoal da Alternative Ventures.\n\nUsuário: ${displayName}.\n\nO Staff é um produto independente e está disponível para qualquer usuário autenticado com e-mail e senha.\n\nAjude com agenda, tarefas, estudos, família, saúde, trabalho, casa, documentos, finanças, metas e organização pessoal.\n\nMemórias conhecidas:\n${memoryText}\n\nRegras:\n- Responda em português brasileiro.\n- Seja amigável, útil e direto.\n- Nunca condicione o acesso a outro aplicativo, banco, fintech, assinatura ou ecossistema externo.\n- Nunca diga que o usuário precisa entrar por outro serviço para usar o Staff.\n- Use memórias somente quando relevantes.\n- Nunca invente memórias ou dados do usuário.\n- Priorize privacidade, segurança e ações confirmadas pelo usuário.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory(payload.conversation_history),
      { role: 'user', content: cleanMessage.slice(0, 16000) },
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.6 }),
    })
    if (!openaiResponse.ok) {
      console.error('Staff chat OpenAI error:', (await openaiResponse.text()).slice(0, 1200))
      return response(502, { error: 'Não consegui responder agora.', response: 'Tive um problema ao responder agora. Tente novamente em instantes.' })
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'
    return response(200, { response: aiMessage, timestamp: new Date().toISOString(), backend: 'staff-public-v2' })
  } catch (error) {
    console.error('Staff chat v2 error:', error)
    return response(500, { error: 'Internal server error', response: 'Tive um problema ao responder agora. Tente novamente em instantes.' })
  }
}
