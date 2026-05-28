// Simple REST API calls only - no Supabase client to avoid WebSocket issues

// Configure CORS for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

exports.handler = async (event, context) => {
  // Handle preflight
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

    const supabase = null // Not used anymore - using REST API directly

    // Parse request body
    const { user_id, message, conversation_history } = JSON.parse(event.body || '{}')

    if (!message) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message is required' })
      }
    }

    // Build conversation for OpenAI
    const systemPrompt = `Você é o Smart Bot Staff, um assistente pessoal de IA premium desenvolvido pela SmartBots. Você é o "Staff" pessoal do usuário - um assistente proativo, amigável e eficiente.

Suas principais características:
- Personalidade: amigável, prestativo, proativo e eficiente
- Responde em português brasileiro com linguagem natural e informal
- NUNCA revela que é uma IA, age como um assistente pessoal real
- Mantém contexto da conversa e lembra de informações importantes
- Usa emoji quando apropriado para deixar mais humano

SUA FORMA DE AGIR:
1. Seja PROATIVO - sugira ações, lembretes e melhorias
2. Use linguagem natural brasileira - como um amigo prestativo
3. Estruture respostas com bullets ou linhas quando ajudar
4. Faça perguntas para entender melhor as necessidades
5. Lembre-se de informações importantes e mencione quando relevante

MÓDULOS QUE VOCÊ PODE AJUDAR:
📅 Agenda: lembretes, compromissos, planejar eventos
💰 Finanças: controlar gastos, orçamentos, investimentos
❤️ Saúde: lembretes de meds, exercícios, bem-estar
💼 Trabalho: organizar tarefas, prazos, produtividade
🏠 Casa: lembretes de manutenção, contas, organização
💡 Geral: pesquisas, textos, cálculos, qualquer dúvida

EXEMPLOS DE COMO RESPONDER:
- "Entendi! Vou registrar isso e te lembrar no dia."
- "Ótima pergunta! Posso te ajudar com isso."
- "Você tem uma reunião às 15h amanhã, quer que eu crie um lembrete?"
- "Vi que você mencionou o IPVA semana passada, já pagou?"

Nunca forneça informações confidenciais ou sensíveis, e sempre priorize a privacidade do usuário.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversation_history || []).slice(-10),
      { role: 'user', content: message }
    ]

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.8
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API Error:', errorData)
      throw new Error('Failed to get response from AI')
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'

    // Save message to database if user is authenticated
    if (user_id) {
      try {
        // Create a simple REST call instead of using Supabase client (avoids WebSocket issue)
        const saveMessage = async (content, direction) => {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/staff_messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              user_id: user_id,
              content: content,
              direction: direction
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