const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function response(statusCode, body) {
  return { statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return response(405, { error: 'Método não permitido.' })

  try {
    const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
    const backendSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const openaiKey = process.env.OPENAI_API_KEY || ''
    if (!supabaseUrl || !backendSecret || !openaiKey) return response(500, { error: 'Staff backend não configurado.' })

    const authorization = event.headers?.authorization || event.headers?.Authorization || ''
    if (!authorization.startsWith('Bearer ')) return response(401, { error: 'Sessão obrigatória.', response: 'Sua sessão expirou. Entre novamente no Staff.' })

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: backendSecret, Authorization: authorization },
    })
    if (!authResponse.ok) return response(401, { error: 'Sessão inválida.', response: 'Sua sessão expirou. Entre novamente no Staff.' })
    const authUser = await authResponse.json()
    if (!authUser?.id) return response(401, { error: 'Sessão inválida.' })

    const { message, conversation_history } = JSON.parse(event.body || '{}')
    if (!String(message || '').trim()) return response(400, { error: 'Message is required' })

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
        body: JSON.stringify({ user_id: finalUserId, category: 'geral', memory: memoryText }),
      })
      return result.ok
    }

    async function getMemories() {
      const result = await fetch(`${supabaseUrl}/rest/v1/staff_memories?user_id=eq.${encodeURIComponent(finalUserId)}&select=category,memory,created_at&order=created_at.desc&limit=50`, {
        headers: { apikey: backendSecret, Authorization: `Bearer ${backendSecret}` },
      })
      return result.ok ? result.json() : []
    }

    const cleanMessage = String(message).trim()
    if (cleanMessage.toLowerCase().startsWith('lembrar:')) {
      const memoryText = cleanMessage.replace(/lembrar:/i, '').trim()
      if (!memoryText) return response(400, { response: 'Me diga o que devo lembrar. Exemplo: lembrar: meu carro é um Corolla 2023' })
      await saveMemory(memoryText)
      return response(200, { response: `Perfeito. Vou lembrar disso: ${memoryText}`, timestamp: new Date().toISOString() })
    }

    const memories = await getMemories()
    const memoryText = memories.length ? memories.map((item) => `- ${item.memory}`).join('\n') : 'Nenhuma memória salva ainda.'

    const systemPrompt = `Você é o Staff, assistente pessoal da Alternative Ventures.\n\nUsuário: ${displayName}.\n\nAjude com agenda, tarefas, estudos, família, saúde, trabalho, casa, documentos, finanças, metas e organização pessoal.\n\nMemórias conhecidas:\n${memoryText}\n\nRegras:\n- Responda em português brasileiro.\n- Seja amigável, útil e direto.\n- Use memórias somente quando relevantes.\n- Nunca invente memórias ou dados do usuário.\n- Nexa é uma integração opcional e nunca deve ser exigida para usar o Staff.\n- Priorize privacidade, segurança e ações confirmadas pelo usuário.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(conversation_history) ? conversation_history.slice(-10) : []),
      { role: 'user', content: cleanMessage },
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000, temperature: 0.7 }),
    })
    if (!openaiResponse.ok) {
      console.error('Staff chat OpenAI error:', (await openaiResponse.text()).slice(0, 1000))
      return response(502, { error: 'Não consegui responder agora.', response: 'Tive um problema ao responder agora. Tente novamente em instantes.' })
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'

    try {
      const saveMessage = (content, direction) => fetch(`${supabaseUrl}/rest/v1/staff_messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: backendSecret,
          Authorization: `Bearer ${backendSecret}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ user_id: finalUserId, content, direction }),
      })
      await saveMessage(cleanMessage, 'inbound')
      await saveMessage(aiMessage, 'outbound')
    } catch (error) {
      console.error('Staff chat persistence warning:', error)
    }

    return response(200, { response: aiMessage, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Chat function error:', error)
    return response(500, { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) })
  }
}
