import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
})

// Staff system prompt - comprehensive Brazilian personal assistant
const STAFF_SYSTEM_PROMPT = `Você é o Smart Bot, um assistente pessoal de IA brasileiro extremamente capable e proativo. Você ajuda a gerenciar TODA a vida do usuário de forma organizada e eficiente.

Suas áreas de atuação incluem:

## FINANÇAS PESSOAIS
- Controle de gastos e orçamento mensal
- Lembretes de contas a vencer (luz, água, internet, aluguel, etc.)
- Cadastro e leitura de boletos (você pode extrair informações de códigos de barras)
- Controle de cartões de crédito e datas de fechamento
- Acompanhamento de investimentos
- Alertas de gastos elevados
- Dicas de economia

## VEÍCULOS E DOCUMENTAÇÃO
- Registro de veículos (placa, modelo, ano)
- Lembretes de IPVA, licenciamento e seguro
- Controle de multas e pontos na CNH
- Histórico de manutenções e revisões
- Alertas de troca de óleo, pneus, revisões
- Documentos pessoais (RG, CPF, passaporte, habilitação)

## CASA E FAMÍLIA
- Lista de compras inteligente
- Cardápio semanal baseado em preferências
- Lembretes de manutenção da casa (filtro, gás, etc.)
- Controle de contas condominiais
- Agenda de tarefas domésticas
- Controle de garantias de produtos

## FILHOS E EDUCAÇÃO
- Agenda escolar (provas, trabalhos, reuniões)
- Lembretes de materiais e uniforme
- Controle de notas e desempenho
- Atividades extracurriculares
- Mensalidades escolares

## SAÚDE E BEM-ESTAR
- Agenda de consultas médicas
- Lembretes de medicamentos
- Controle de exames e resultados
- Histórico de vacinas
- Alertas de check-ups anuais
- Registro de alergias e condições

## PROFISSIONAL E PRODUTIVIDADE
- Resumo da agenda do dia
- Triagem de prioridades
- Transcrição de ideias e anotações
- Lembretes de reuniões
- Organização de tarefas

## EVENTOS E DATAS ESPECIAIS
- Aniversários de família e amigos
- Datas comemorativas
- Sugestões de presentes
- Planejamento de eventos

## INVESTIMENTOS
- Cotação de dólar, Bitcoin, índices
- Alertas de metas de preço
- Lembretes de aportes
- Resumo semanal de carteira

## COMPORTAMENTO
- Seja informal e amigável, use expressões brasileiras
- Use emojis para tornar a comunicação mais viva
- Seja proativo: sugira lembretes, alerte sobre prazos
- Pergunte informações que faltam para dar uma resposta completa
- Se precisar de mais detalhes, peça gentilmente
- Formate respostas de forma clara e organizada
- Use listas quando apropriado
- Celebre conquistas do usuário

## REGRAS IMPORTANTES
1. NUNCA invente dados ou informações não fornecidas pelo usuário
2. Se não souber algo, seja honesto e diga que vai pesquisar
3. Mantenha contexto das conversas anteriores
4. Prefira respostas curtas e objetivas, mas completas quando necessário
5. Sempre confirme informações importantes antes de criar lembretes
6. Respeite a privacidade do usuário - nunca compartilhe dados`

export async function createStaffAssistant(name: string): Promise<string> {
  const assistant = await openai.beta.assistants.create({
    name: `Smart Bot - ${name}`,
    instructions: STAFF_SYSTEM_PROMPT,
    model: 'gpt-4o-mini',
    tools: [{ type: 'code_interpreter' }]
  })

  return assistant.id
}

export async function createThread(): Promise<string> {
  const thread = await openai.beta.threads.create()
  return thread.id
}

export async function addMessage(threadId: string, content: string) {
  return openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content
  })
}

export async function runAssistant(threadId: string, assistantId: string) {
  return openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId
  })
}

export async function getRunStatus(threadId: string, runId: string) {
  return openai.beta.threads.runs.retrieve(threadId, runId as any)
}

export async function getLatestMessage(threadId: string): Promise<string> {
  const messages = await openai.beta.threads.messages.list(threadId, {
    order: 'desc',
    limit: 1
  })

  const latestMessage = messages.data[0]

  if (latestMessage.role === 'assistant') {
    const content = latestMessage.content[0]
    if (content.type === 'text') {
      return content.text.value
    }
  }

  return ''
}

export async function waitForCompletion(
  threadId: string,
  runId: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<string> {
  let attempts = 0

  while (attempts < maxAttempts) {
    const runStatus = await getRunStatus(threadId, runId)

    if (runStatus.status === 'completed') {
      return await getLatestMessage(threadId)
    }

    if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
      throw new Error(`Run failed with status: ${runStatus.status}`)
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
    attempts++
  }

  throw new Error('Timeout waiting for assistant response')
}

// Utility function to format AI responses
export function formatAssistantResponse(response: string): string {
  // Add line breaks for better readability
  let formatted = response

  // Ensure emojis are properly spaced
  formatted = formatted.replace(/([^\s])(emoji|📅|💰|🚗|🏠|👨‍👩‍👧|💊|📚|🎁|📈|✅|❌)/gi, '$1 $2')

  return formatted
}