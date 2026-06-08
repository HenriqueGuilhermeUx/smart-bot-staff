// Simple REST API calls only - no Supabase client to avoid WebSocket issues

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY } = process.env

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Server configuration missing' })
      }
    }

    const { user_id, message, conversation_history } = JSON.parse(event.body || '{}')

    if (!message) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message is required' })
      }
    }

    async function saveMemory(memoryText) {
      if (!user_id || !memoryText) return false

      const response = await fetch(`${SUPABASE_URL}/rest/v1/staff_memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id,
          category: 'geral',
          memory: memoryText
        })
      })

      return response.ok
    }

    async function getMemories() {
      if (!user_id) return []

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_memories?user_id=eq.${encodeURIComponent(user_id)}&select=category,memory,created_at&order=created_at.desc&limit=50`,
        {
          method: 'GET',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      )

      if (!response.ok) return []

      return await response.json()
    }

    const lowerMessage = String(message).toLowerCase().trim()

    if (lowerMessage.startsWith('lembrar:')) {
      const memoryText = message.replace(/lembrar:/i, '').trim()

      if (!memoryText) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response: 'Me diga o que devo lembrar. Exemplo: lembrar: meu carro é um Corolla 2023'
          })
        }
      }

      await saveMemory(memoryText)

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: `Perfeito. Vou lembrar disso: ${memoryText}`,
          timestamp: new Date().toISOString()
        })
      }
    }

    const memories = await getMemories()

    const memoryText = memories.length
      ? memories.map((m) => `- ${m.memory}`).join('\n')
      : 'Nenhuma memória salva ainda.'

    const systemPrompt = `Você é o Staff by Nexa, assistente pessoal premium do ecossistema Nexa.

Você ajuda o usuário com:
📅 Agenda
💰 Finanças
❤️ Saúde
💼 Trabalho
🏠 Casa
📄 Documentos
🔒 Segurança
💡 Organização pessoal

Memórias conhecidas do usuário:
${memoryText}

Regras:
- Responda em português brasileiro
- Seja amigável, útil e direto
- Use as memórias quando forem relevantes
- Nunca invente memórias
- Se o usuário disser algo importante sobre vida, carro, saúde, família, rotina, finanças ou documentos, sugira: "Posso guardar isso como memória se você escrever: lembrar: ..."
- Não diga que é IA
- Priorize privacidade e segurança`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversation_history || []).slice(-10),
      { role: 'user', content: message }
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API Error:', errorData)
      throw new Error('Failed to get response from AI')
    }

    const aiData = await openaiResponse.json()
    const aiMessage =
      aiData.choices?.[0]?.message?.content ||
      'Desculpe, não consegui processar sua mensagem.'

    if (user_id) {
      try {
        const saveMessage = async (content, direction) => {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/staff_messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              user_id,
              content,
              direction
            })
          })

          return response.ok
        }

        await saveMessage(message, 'inbound')
        await saveMessage(aiMessage, 'outbound')
      } catch (dbError) {
        console.log('Could not save to database, continuing...')
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: aiMessage,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Chat function error:', error)

    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    }
  }
}
