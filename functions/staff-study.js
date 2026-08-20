const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

async function authenticatedUser(event, supabaseUrl, serviceRoleKey) {
  const authorization = event.headers.authorization || event.headers.Authorization || ''
  if (!authorization.startsWith('Bearer ')) return null

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: authorization,
    },
  })
  if (!response.ok) return null
  return response.json()
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  for (const item of response.output || []) {
    if (item.type !== 'message') continue
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text
    }
  }
  return ''
}

const studyPackSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'subject', 'summary', 'study_text', 'key_points', 'questions', 'flashcards', 'source_warnings'],
  properties: {
    title: { type: 'string' },
    subject: { type: 'string' },
    summary: { type: 'string' },
    study_text: { type: 'string' },
    key_points: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 12 },
    questions: {
      type: 'array', minItems: 5, maxItems: 12,
      items: {
        type: 'object', additionalProperties: false,
        required: ['question', 'options', 'correct_index', 'explanation'],
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
          correct_index: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
        },
      },
    },
    flashcards: {
      type: 'array', minItems: 4, maxItems: 16,
      items: {
        type: 'object', additionalProperties: false,
        required: ['front', 'back'],
        properties: { front: { type: 'string' }, back: { type: 'string' } },
      },
    },
    source_warnings: { type: 'array', items: { type: 'string' }, maxItems: 8 },
  },
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' })

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_STUDY_MODEL } = process.env
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return json(500, { error: 'O módulo de Estudos ainda não foi configurado no servidor.' })
    }

    const user = await authenticatedUser(event, SUPABASE_URL.replace(/\/+$/, ''), SUPABASE_SERVICE_ROLE_KEY)
    if (!user?.id) return json(401, { error: 'Sua sessão expirou. Entre novamente no Staff.' })

    const payload = JSON.parse(event.body || '{}')
    const {
      child_name,
      age_group,
      school_grade,
      file_name,
      mime_type,
      file_base64,
      source_only = true,
    } = payload

    if (!child_name || !file_name || !mime_type || !file_base64) return json(400, { error: 'Arquivo e perfil da criança são obrigatórios.' })
    if (!String(mime_type).startsWith('image/') && mime_type !== 'application/pdf') return json(400, { error: 'Envie uma foto ou PDF.' })
    if (String(file_base64).length > 7_500_000) return json(413, { error: 'Arquivo grande demais. Envie uma imagem menor ou divida o PDF.' })

    const instructions = source_only
      ? 'Use SOMENTE informações claramente presentes no material enviado. Não complete lacunas com conhecimento externo. Se algo estiver ilegível, ambíguo ou ausente, registre em source_warnings e não invente.'
      : 'Use o material como base principal. Você pode acrescentar conhecimento escolar geral apenas quando isso ajudar a explicar, deixando claro que é complemento.'

    const prompt = `Você prepara material de estudo para uma criança a partir de conteúdo enviado por seu responsável legal.

Perfil: ${child_name}; faixa etária ${age_group || 'não informada'}; série ${school_grade || 'não informada'}.

${instructions}

Regras pedagógicas:
- Português brasileiro claro e adequado à idade.
- Identifique disciplina e tema sem inventar detalhes.
- Faça um resumo curto e depois um texto de estudo didático.
- Crie pontos-chave.
- Crie perguntas de múltipla escolha baseadas no material, com opções plausíveis, apenas uma correta e explicação curta.
- Crie flashcards objetivos.
- Não peça dados pessoais da criança.
- Não inclua publicidade, links, compras ou convites para sair do Staff.
- Se o arquivo não for material escolar ou estiver insuficiente, ainda devolva a estrutura, mas explique o problema em source_warnings.`

    const fileContent = String(mime_type).startsWith('image/')
      ? { type: 'input_image', image_url: `data:${mime_type};base64,${file_base64}`, detail: 'high' }
      : { type: 'input_file', filename: file_name, file_data: file_base64 }

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_STUDY_MODEL || 'gpt-5-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, fileContent] }],
        text: {
          format: {
            type: 'json_schema',
            name: 'staff_study_pack',
            strict: true,
            schema: studyPackSchema,
          },
        },
        max_output_tokens: 5000,
      }),
    })

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text()
      console.error('Staff study OpenAI error:', detail.slice(0, 1200))
      return json(502, { error: 'Não consegui analisar este material agora. Tente novamente em instantes.' })
    }

    const responseData = await openaiResponse.json()
    const outputText = extractOutputText(responseData)
    if (!outputText) return json(502, { error: 'A análise terminou sem conteúdo. Tente outra foto mais nítida.' })

    let studyPack
    try {
      studyPack = JSON.parse(outputText)
    } catch (error) {
      console.error('Invalid study JSON:', outputText.slice(0, 800))
      return json(502, { error: 'Não consegui estruturar o estudo. Tente novamente com uma foto mais nítida.' })
    }

    return json(200, { study_pack: studyPack })
  } catch (error) {
    console.error('Staff study error:', error)
    return json(500, { error: 'Tive um problema ao preparar o material de estudo.' })
  }
}
