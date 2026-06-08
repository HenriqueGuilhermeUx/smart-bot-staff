function getNexaToken(): string {
  if (typeof window === 'undefined') return ''

  const params = new URLSearchParams(window.location.search)
  const tokenFromUrl = params.get('nexaToken')

  if (tokenFromUrl) {
    localStorage.setItem('nexaToken', tokenFromUrl)

    const cleanUrl = window.location.origin + window.location.pathname
    window.history.replaceState({}, document.title, cleanUrl)

    return tokenFromUrl
  }

  return localStorage.getItem('nexaToken') || ''
}

export async function sendStaffMessage({
  userId,
  message,
  conversationHistory = [],
}: {
  userId?: string
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<string> {
  const nexaToken = getNexaToken()

  const response = await fetch('/.netlify/functions/staff-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      message,
      conversation_history: conversationHistory,
      nexaToken,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return (
      data.response ||
      'O Staff Premium é exclusivo para clientes Nexa. Abra pelo app Nexa para liberar seu acesso.'
    )
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
