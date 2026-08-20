function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function getAuthenticatedUser(request: Request, supabaseUrl: string, serviceRoleKey: string) {
  const authorization = request.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: authorization },
  })
  if (!response.ok) return null
  return response.json()
}

function extractOutputText(response: any) {
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
          options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
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

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const openaiKey = process.env.OPENAI_API_KEY || ''
    const model = process.env.OPENAI_STUDY_MODEL || 'gpt-5-mini'
    if (!supabaseUrl || !serviceRoleKey || !openaiKey) return json({ error: 'O módulo de Estudos ainda não foi configurado no servidor.' }, 500)

    const user = await getAuthenticatedUser(request, supabaseUrl, serviceRoleKey)
    if (!user?.id) return json({ error: 'Sua sessão expirou. Entre novamente no Staff.' }, 401)

    const payload = await request.json().catch(() => ({} as any)) as any
    const { child_name, age_group, school_grade, file_name, mime_type, file_base64, source_only = true } = payload
    if (!child_name || !file_name || !mime_type || !file_base64) return json({ error: 'Arquivo e perfil da criança são obrigatórios.' }, 400)
    if (!String(mime_type).startsWith('image/') && mime_type !== 'application/pdf') return json({ error: 'Envie uma foto ou PDF.' }, 400)
    if (String(file_base64).length > 7_500_000) return json({ error: 'Arquivo grande demais. Envie uma imagem menor ou divida o PDF.' }, 413)

    const grounding = source_only
      ? 'Use SOMENTE informações claramente presentes no material enviado. Não complete lacunas com conhecimento externo. Se algo estiver ilegível, ambíguo ou ausente, registre em source_warnings e não invente.'
      : 'Use o material como base principal. Conhecimento escolar complementar só pode ser acrescentado quando ajudar a explicar e deve ser identificado como complemento.'

    const instructions = `Você prepara material de estudo para uma criança a partir de conteúdo enviado por seu responsável legal.\n\nPerfil: ${child_name}; faixa etária ${age_group || 'não informada'}; série ${school_grade || 'não informada'}.\n\n${grounding}\n\nRegras:\n- Português brasileiro claro e adequado à idade.\n- Identifique disciplina e tema sem inventar detalhes.\n- Faça resumo curto e texto didático.\n- Crie pontos-chave, perguntas de múltipla escolha com quatro opções e uma correta, explicações curtas e flashcards.\n- Não peça dados pessoais da criança.\n- Não inclua publicidade, links, compras ou convites para sair do Staff.\n- Se o arquivo for insuficiente, preserve a estrutura e descreva a limitação em source_warnings.`

    const fileContent = String(mime_type).startsWith('image/')
      ? { type: 'input_image', image_url: `data:${mime_type};base64,${file_base64}`, detail: 'high' }
      : { type: 'input_file', filename: file_name, file_data: file_base64 }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: instructions }, fileContent] }],
        text: { format: { type: 'json_schema', name: 'staff_study_pack', strict: true, schema: studyPackSchema } },
        max_output_tokens: 5000,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Staff study OpenAI error:', detail.slice(0, 1200))
      return json({ error: 'Não consegui analisar este material agora. Tente novamente em instantes.' }, 502)
    }

    const responseData = await response.json()
    const outputText = extractOutputText(responseData)
    if (!outputText) return json({ error: 'A análise terminou sem conteúdo. Tente outra foto mais nítida.' }, 502)

    try {
      return json({ study_pack: JSON.parse(outputText) })
    } catch {
      return json({ error: 'Não consegui estruturar o estudo. Tente novamente com uma foto mais nítida.' }, 502)
    }
  } catch (error) {
    console.error('Staff study error:', error)
    return json({ error: 'Tive um problema ao preparar o material de estudo.' }, 500)
  }
}
