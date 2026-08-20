export async function sendStaffMessage({
  message,
  conversationHistory = [],
}: {
  userId?: string
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<string> {
  const response = await fetch('/.netlify/functions/staff-chat-v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return data.response || 'Não foi possível responder agora. Tente novamente em instantes.'
  }

  return data.response || 'Desculpe, não consegui processar sua mensagem.'
}

export function formatAssistantResponse(response: string): string {
  let formatted = response

  formatted = formatted.replace(
    /([^\s])(emoji|📅|💰|🚗|🏠|👨‍👩‍👧|💊|📚|🎁|📈|✅|❌)/gi,
    '$1 $2',
  )

  return formatted
}
