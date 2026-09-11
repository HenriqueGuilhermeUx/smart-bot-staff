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

function compactDocument(item) {
  return {
    id: item.id,
    title: item.title || item.document_type,
    type: item.document_type,
    issuer: item.issuer || null,
    documentNumber: item.document_number || null,
    issueDate: item.issue_date || null,
    dueDate: item.due_date || null,
    totalAmount: item.total_amount ?? null,
    currency: item.currency || 'BRL',
    summary: item.summary ? String(item.summary).slice(0, 1200) : null,
    items: Array.isArray(item.items) ? item.items.slice(0, 8).map((entry) => ({
      description: entry?.description ? String(entry.description).slice(0, 180) : null,
      total: entry?.total ?? null,
    })) : [],
    obligations: Array.isArray(item.obligations) ? item.obligations.slice(0, 8).map((entry) => ({
      description: entry?.description ? String(entry.description).slice(0, 240) : null,
      dueDate: entry?.dueDate || entry?.due_date || null,
    })) : [],
  }
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
      return response(401, {
        error: 'Sessão obrigatória.',
        response: 'Sua sessão expirou. Entre novamente no Staff com seu e-mail e senha.',
      })
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: backendSecret, Authorization: authorization },
    })

    if (!authResponse.ok) {
      return response(401, {
        error: 'Sessão inválida.',
        response: 'Sua sessão expirou. Entre novamente no Staff com seu e-mail e senha.',
      })
    }

    const authUser = await authResponse.json()
    if (!authUser?.id) return response(401, { error: 'Sessão inválida.' })

    const payload = JSON.parse(event.body || '{}')
    const cleanMessage = String(payload.message || '').trim()
    if (!cleanMessage) return response(400, { error: 'Mensagem obrigatória.' })

    const finalUserId = authUser.id
    const displayName = authUser.user_metadata?.name || authUser.email?.split('@')?.[0] || 'usuário'
    const serviceHeaders = { apikey: backendSecret, Authorization: `Bearer ${backendSecret}` }

    async function saveMemory(memoryText) {
      if (!memoryText) return false
      const result = await fetch(`${supabaseUrl}/rest/v1/staff_memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...serviceHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          user_id: finalUserId,
          category: 'pessoal',
          content: memoryText,
          importance: 2,
          user_confirmed: true,
        }),
      })
      if (!result.ok) console.error('Staff memory save warning:', result.status)
      return result.ok
    }

    async function getMemories() {
      const url = `${supabaseUrl}/rest/v1/staff_memories?user_id=eq.${encodeURIComponent(finalUserId)}&archived=eq.false&select=category,content,created_at,source_document_id&order=created_at.desc&limit=30`
      const result = await fetch(url, { headers: serviceHeaders })
      if (!result.ok) {
        console.error('Staff memory read warning:', result.status)
        return []
      }
      return result.json()
    }

    async function getDocumentContext() {
      // Sensitive identity/medical documents are deliberately excluded from the general
      // external AI chat context. Their private file and metadata stay inside Staff.
      const url = `${supabaseUrl}/rest/v1/staff_documents?user_id=eq.${encodeURIComponent(finalUserId)}&status=in.(confirmed,archived)&privacy_class=eq.standard&select=id,title,document_type,issuer,document_number,issue_date,due_date,total_amount,currency,summary,items,obligations&order=updated_at.desc&limit=20`
      const result = await fetch(url, { headers: serviceHeaders })
      if (!result.ok) {
        console.error('Staff document context warning:', result.status)
        return []
      }
      const rows = await result.json()
      return Array.isArray(rows) ? rows.map(compactDocument) : []
    }

    async function getFinancialContext() {
      const url = `${supabaseUrl}/rest/v1/staff_financial_entries?user_id=eq.${encodeURIComponent(finalUserId)}&select=description,amount,currency,occurred_on,category,merchant,source_document_id&order=occurred_on.desc&limit=30`
      const result = await fetch(url, { headers: serviceHeaders })
      if (!result.ok) {
        console.error('Staff financial context warning:', result.status)
        return []
      }
      const rows = await result.json()
      return Array.isArray(rows) ? rows.slice(0, 30) : []
    }

    if (cleanMessage.toLowerCase().startsWith('lembrar:')) {
      const memoryText = cleanMessage.replace(/lembrar:/i, '').trim()
      if (!memoryText) {
        return response(400, { response: 'Me diga o que devo lembrar. Exemplo: lembrar: prefiro reuniões pela manhã.' })
      }
      const saved = await saveMemory(memoryText)
      return response(200, {
        response: saved
          ? `Perfeito. Vou lembrar disso: ${memoryText}`
          : 'Entendi. Não consegui salvar essa memória agora, mas você pode tentar novamente em instantes.',
        timestamp: new Date().toISOString(),
      })
    }

    const [memories, documents, financialEntries] = await Promise.all([
      getMemories(), getDocumentContext(), getFinancialContext(),
    ])
    const safeDocumentIds = new Set(documents.map((item) => item.id))
    const safeMemories = memories.filter((item) => !item.source_document_id || safeDocumentIds.has(item.source_document_id))
    const memoryText = safeMemories.length ? safeMemories.map((item) => `- ${item.content}`).join('\n') : 'Nenhuma memória salva disponível para este contexto.'
    const documentText = documents.length
      ? documents.map((item) => `- ${JSON.stringify(item)}`).join('\n')
      : 'Nenhum documento comum confirmado disponível.'
    const financialText = financialEntries.length
      ? financialEntries.map((item) => `- ${JSON.stringify(item)}`).join('\n')
      : 'Nenhum lançamento financeiro estruturado disponível.'

    const systemPrompt = `Você é o Staff, assistente pessoal da Alternative Ventures.\n\nUsuário: ${displayName}.\n\nO Staff é um produto independente e está disponível para qualquer usuário autenticado com e-mail e senha.\n\nAjude com agenda, tarefas, estudos, família, saúde, trabalho, casa, documentos, finanças, metas e organização pessoal.\n\nMemórias conhecidas e permitidas para este contexto:\n${memoryText}\n\nDOCUMENTOS COMUNS CONFIRMADOS DO SMART INBOX (somente fatos estruturados; nunca arquivo bruto):\n${documentText}\n\nLANÇAMENTOS FINANCEIROS CONFIRMADOS:\n${financialText}\n\nRegras:\n- Responda em português brasileiro.\n- Seja amigável, útil e direto.\n- Nunca condicione o acesso a outro aplicativo, banco, fintech, assinatura ou ecossistema externo.\n- Use memórias e documentos somente quando relevantes.\n- Nunca invente memórias, documentos ou dados do usuário.\n- Quando uma resposta factual depender de um documento do Smart Inbox, inclua ao final uma linha exatamente no formato: Fonte documental: <título do documento>.\n- Documentos médicos e de identidade não entram automaticamente neste contexto externo; não tente inferir seu conteúdo.\n- Se a pergunta exigir um documento que não aparece no contexto, diga que não encontrou uma fonte documental confirmada disponível e oriente o usuário a abrir o Smart Inbox.\n- Não trate um boleto como despesa paga só porque há um valor; pagamentos e lançamentos financeiros exigem confirmação do usuário na interface.\n- Nunca execute ação financeira sensível pela conversa sem confirmação explícita na interface correspondente.\n- Priorize privacidade, segurança e ações confirmadas pelo usuário.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...safeHistory(payload.conversation_history),
      { role: 'user', content: cleanMessage.slice(0, 16000) },
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 1400, temperature: 0.5 }),
    })

    if (!openaiResponse.ok) {
      console.error('Staff chat OpenAI error:', openaiResponse.status)
      return response(502, {
        error: 'Não consegui responder agora.',
        response: 'Tive um problema ao responder agora. Tente novamente em instantes.',
      })
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'

    return response(200, {
      response: aiMessage,
      timestamp: new Date().toISOString(),
      backend: 'staff-public-v2',
    })
  } catch (error) {
    console.error('Staff chat v2 error:', error instanceof Error ? error.message.slice(0, 160) : 'unknown_error')
    return response(500, {
      error: 'Internal server error',
      response: 'Tive um problema ao responder agora. Tente novamente em instantes.',
    })
  }
}
