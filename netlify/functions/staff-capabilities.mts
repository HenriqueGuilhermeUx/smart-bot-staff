import {
  browserConfigured,
  cleanupBrowserSession,
  parseRunOutput,
  safeHttpsUrl,
  startAppointmentSearch,
  startRestaurantBooking,
  startRestaurantDiscovery,
  waitForRun,
} from './_shared/staff-capabilities-core.mts'
import {
  countRecentFederatedActions,
  env,
  findLatestFederatedAction,
  findPendingFederatedAction,
  insertFederatedAction,
  updateFederatedAction,
  type CapabilityActionRow,
} from './_shared/staff-capability-store.mts'

type SourceApp = 'nexa' | 'healthwallet' | 'mydatamed'

type FederatedProfile = {
  name?: string
  email?: string
  phone?: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function bearer(request: Request) {
  const raw = String(request.headers.get('authorization') || '')
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : ''
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function sourceFromRequest(request: Request): SourceApp | null {
  const source = normalize(String(request.headers.get('x-staff-source') || '').trim())
  if (source === 'nexa' || source === 'healthwallet' || source === 'mydatamed') return source
  return null
}

function subjectFromRequest(request: Request) {
  const subject = String(request.headers.get('x-staff-subject') || '').trim()
  if (!subject || subject.length > 200) return ''
  return subject
}

function looksLikeRestaurantReservation(message: string) {
  const value = normalize(message)
  return (
    /(reserv|reserve|reservar|mesa|jantar|almoco|brunch)/.test(value)
    && /(restaurante|bar|bistro|mesa|jantar|almoco|brunch|pessoa|horario|hora)/.test(value)
  ) || /(marque|marca|agende|agenda).*(restaurante|mesa|jantar|almoco|bar)/.test(value)
}

function looksLikeStatusRequest(message: string) {
  const value = normalize(message).trim()
  return /^(e ai|e aí|status|conseguiu|ja conseguiu|já conseguiu|como esta|como está|deu certo|terminou|acabou)[?!. ]*$/.test(value)
}

function affirmative(message: string) {
  const value = normalize(message).trim()
  return /^(sim|pode|pode sim|confirma|confirmo|reservar|reserve|manda|bora|ok|okay|feito)[!?. ]*$/.test(value)
}

function cancellation(message: string) {
  const value = normalize(message).trim()
  return /^(nao|não|cancela|cancelar|deixa|deixa pra la|deixa pra lá|pare|para)[!?. ]*$/.test(value)
}

function appointmentSearchIntent(message: string) {
  const value = normalize(message)
  const action = /(procur|pesquis|encontr|ver|veja|buscar|busque|agenda|agend|marc|horario|horarios|disponibilidade)/
  const target = /(consulta|clinica|medico|medica|dentista|psicolog|fisioterap|nutricion|laboratorio|exame|telemedicina|especialista)/
  return action.test(value) && target.test(value)
}

async function validateHealthSession(token: string, subjectId: string) {
  if (!token) return false
  const url = env('STAFF_HEALTHWALLET_SESSION_URL') || 'https://mydatamed.com/api/staff/session'
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })
    const payload = await response.json().catch(() => ({}))
    return response.ok && payload?.valid === true && String(payload?.userId || '') === subjectId
  } catch {
    return false
  }
}

async function authorize(request: Request) {
  const sourceApp = sourceFromRequest(request)
  const subjectId = subjectFromRequest(request)
  const token = bearer(request)
  if (!sourceApp || !subjectId || !token) return null

  if (sourceApp === 'nexa') {
    const expected = env('STAFF_NEXA_SERVICE_KEY')
    if (!expected || token !== expected) return null
    return { sourceApp, subjectId }
  }

  if (await validateHealthSession(token, subjectId)) {
    return { sourceApp, subjectId }
  }

  return null
}

function publicAction(action: CapabilityActionRow) {
  const confirmationKind = String(action.result_json?.confirmationKind || '')
  const discovery = (action.result_json?.discovery || {}) as Record<string, unknown>
  return {
    actionId: action.id,
    capability: action.capability,
    status: action.status,
    response: action.result_summary || (
      action.status === 'running'
        ? 'Estou verificando a disponibilidade na web.'
        : 'A ação está aguardando continuação.'
    ),
    confirmationKind: confirmationKind || null,
    alternatives: Array.isArray(discovery.alternatives) ? discovery.alternatives.slice(0, 3) : [],
  }
}

async function invokeWorker(request: Request, action: CapabilityActionRow) {
  const internalKey = env('STAFF_CAPABILITIES_INTERNAL_KEY') || env('STAFF_NEXA_SERVICE_KEY')
  if (!internalKey) throw new Error('CAPABILITY_WORKER_NOT_CONFIGURED')
  const origin = new URL(request.url).origin
  const response = await fetch(`${origin}/.netlify/functions/staff-capabilities-worker`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${internalKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      actionId: action.id,
      sourceApp: action.source_app,
      subjectId: action.external_subject_id,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok && response.status !== 202) {
    throw new Error(`CAPABILITY_WORKER_START_${response.status}`)
  }
}

async function startNexaRestaurant(
  request: Request,
  subjectId: string,
  message: string,
) {
  if (await countRecentFederatedActions('nexa', subjectId) >= 10) {
    return {
      handled: true,
      status: 'failed',
      code: 'WEB_ACTION_DAILY_LIMIT',
      response: 'O limite diário de ações web foi atingido. Tente novamente amanhã.',
    }
  }

  const action = await insertFederatedAction({
    sourceApp: 'nexa',
    subjectId,
    capability: 'web.restaurant.reserve',
    requestText: message,
    intent: 'restaurant_reservation',
    riskLevel: 'low',
    status: 'queued',
    resultJson: { phase: 'discovery', browserApi: 'v4' },
  })

  const run = await startRestaurantDiscovery(message)
  const running = await updateFederatedAction(action.id, {
    status: 'running',
    external_task_id: run.runId,
    external_session_id: run.sessionId || null,
    result_summary: 'Estou procurando disponibilidade e o canal correto de reserva.',
    result_json: { phase: 'discovery', browserApi: 'v4' },
  })
  await invokeWorker(request, running)

  return {
    handled: true,
    actionId: running.id,
    capability: 'web.restaurant.reserve',
    status: 'running',
    response: 'Estou verificando a disponibilidade e o canal correto de reserva. Você pode continuar usando a Nexa; se quiser conferir depois, pergunte “conseguiu?”.',
  }
}

async function continueNexaRestaurant(
  request: Request,
  action: CapabilityActionRow,
  message: string,
  profile: FederatedProfile,
) {
  if (action.status === 'running') {
    if (!looksLikeStatusRequest(message)) return { handled: false, activeActionId: action.id }
    return { handled: true, ...publicAction(action) }
  }

  const kind = String(action.result_json?.confirmationKind || '')
  const discovery = (action.result_json?.discovery || {}) as Record<string, unknown>

  if (action.status === 'needs_profile') {
    const profileReady = Boolean(
      String(profile?.name || '').trim()
      && String(profile?.email || '').trim()
      && String(profile?.phone || '').trim(),
    )
    if (!profileReady) {
      return {
        handled: true,
        actionId: action.id,
        status: 'needs_profile',
        response: 'Encontrei a reserva, mas ainda preciso de nome, e-mail e telefone cadastrados na Nexa para preencher o contato.',
      }
    }

    await updateFederatedAction(action.id, {
      status: 'needs_confirmation',
      result_summary: action.result_summary || 'Seu perfil está completo e a reserva está pronta para confirmação.',
    })
    return {
      handled: true,
      actionId: action.id,
      status: 'needs_confirmation',
      confirmationKind: kind || 'confirm_booking',
      response: 'Seu perfil já está completo. Se quiser que eu conclua a reserva, responda “sim”.',
    }
  }

  if (kind === 'manual_takeover') {
    return { handled: true, ...publicAction(action) }
  }

  if (cancellation(message)) {
    await updateFederatedAction(action.id, {
      status: 'cancelled',
      result_summary: 'Reserva cancelada a pedido do usuário.',
    })
    return {
      handled: true,
      actionId: action.id,
      status: 'cancelled',
      response: 'Certo. Cancelei essa tentativa de reserva.',
    }
  }

  if (kind === 'clarification') {
    const combined = `${action.request_text}\nComplemento do usuário: ${message}`
    const run = await startRestaurantDiscovery(combined)
    const running = await updateFederatedAction(action.id, {
      request_text: combined.slice(0, 4000),
      status: 'running',
      external_task_id: run.runId,
      external_session_id: run.sessionId || null,
      result_summary: 'Estou verificando novamente com esse complemento.',
      result_json: { phase: 'discovery', browserApi: 'v4' },
    })
    await invokeWorker(request, running)
    return {
      handled: true,
      actionId: action.id,
      status: 'running',
      response: 'Perfeito. Estou verificando novamente com essa informação.',
    }
  }

  if (kind === 'confirm_booking' && !affirmative(message)) {
    return {
      handled: true,
      ...publicAction(action),
      response: `${action.result_summary || 'Encontrei o horário solicitado.'} Se quiser que eu conclua a reserva, responda “sim”.`,
    }
  }

  let selectedTime: string | null = null
  if (kind === 'alternative_time') {
    const alternatives = Array.isArray(discovery.alternatives)
      ? discovery.alternatives.map((item) => String(item))
      : []
    const normalized = normalize(message)
    selectedTime = alternatives.find((item) => normalized.includes(normalize(item))) || null
    if (!selectedTime) {
      return {
        handled: true,
        ...publicAction(action),
        response: `${action.result_summary || 'O horário pedido não está disponível.'} Escolha um destes horários: ${alternatives.join(', ')}.`,
      }
    }
  }

  if (kind !== 'confirm_booking' && kind !== 'alternative_time') {
    return { handled: true, ...publicAction(action) }
  }

  const name = String(profile?.name || '').trim()
  const email = String(profile?.email || '').trim()
  const phone = String(profile?.phone || '').trim()
  if (!name || !email || !phone) {
    await updateFederatedAction(action.id, { status: 'needs_profile' })
    return {
      handled: true,
      actionId: action.id,
      status: 'needs_profile',
      response: 'Para concluir a reserva com segurança, complete nome, e-mail e telefone no seu perfil da Nexa.',
    }
  }

  const run = await startRestaurantBooking(
    action.request_text,
    discovery,
    { name, email, phone },
    selectedTime,
  )

  const bookingUrl = safeHttpsUrl(discovery.bookingUrl)
  const running = await updateFederatedAction(action.id, {
    status: 'running',
    external_task_id: run.runId,
    external_session_id: run.sessionId || null,
    result_summary: 'Estou preenchendo a reserva.',
    result_json: {
      phase: 'booking',
      discovery,
      selectedTime,
      bookingHost: run.bookingHost || bookingUrl?.hostname || '',
      browserApi: 'v4',
    },
  })
  await invokeWorker(request, running)

  return {
    handled: true,
    actionId: action.id,
    status: 'running',
    response: 'Certo. Estou tentando concluir a reserva agora. Se o site pedir pagamento, login, cartão ou código, eu paro antes.',
  }
}

async function routeNexa(
  request: Request,
  subjectId: string,
  message: string,
  profile: FederatedProfile,
) {
  const pending = await findPendingFederatedAction('nexa', subjectId, 'web.restaurant.reserve')
  if (pending) return continueNexaRestaurant(request, pending, message, profile)

  if (looksLikeStatusRequest(message)) {
    const latest = await findLatestFederatedAction('nexa', subjectId, 'web.restaurant.reserve', 2)
    if (latest) return { handled: true, ...publicAction(latest) }
  }

  if (!looksLikeRestaurantReservation(message)) return { handled: false }
  return startNexaRestaurant(request, subjectId, message)
}

async function invokeHealthAppointmentSearch(
  message: string,
  consent: boolean,
) {
  if (!consent) {
    return {
      handled: true,
      status: 'needs_confirmation',
      confirmationKind: 'external_web_search_consent',
      response: 'Posso pesquisar disponibilidade na web usando apenas o pedido operacional. Não vou enviar prontuário, exames, medicamentos ou histórico clínico. Confirme para continuar.',
    }
  }

  if (!appointmentSearchIntent(message)) {
    return {
      handled: false,
      code: 'CAPABILITY_NOT_APPLICABLE',
    }
  }

  const run = await startAppointmentSearch(message)
  const waited = await waitForRun(run.runId, 48_000)
  await cleanupBrowserSession(run.sessionId)

  if (waited.status !== 'completed') {
    return {
      handled: true,
      status: 'failed',
      response: 'Não consegui concluir a pesquisa de disponibilidade agora. Nenhum dado clínico foi enviado ou armazenado no Staff.',
    }
  }

  const result = parseRunOutput(waited.run)
  const rawOptions = Array.isArray(result.options) ? result.options : []
  const options = rawOptions.slice(0, 5).map((item: any) => {
    const bookingUrl = safeHttpsUrl(item?.bookingUrl)
    return {
      provider: item?.provider ? String(item.provider).slice(0, 180) : null,
      date: item?.date ? String(item.date).slice(0, 60) : null,
      time: item?.time ? String(item.time).slice(0, 60) : null,
      location: item?.location ? String(item.location).slice(0, 220) : null,
      bookingUrl: bookingUrl?.toString() || null,
    }
  })

  return {
    handled: true,
    status: String(result.status || 'completed') === 'needs_input' ? 'needs_confirmation' : 'completed',
    confirmationKind: String(result.status || '') === 'needs_input' ? 'clarification' : null,
    response: String(result.summary || 'Pesquisa concluída.').slice(0, 3000),
    options,
    privacy: {
      persistedInStaff: false,
      clinicalContextIncluded: false,
    },
  }
}

export default async (request: Request) => {
  if (request.method === 'GET') {
    return json(200, {
      status: 'ok',
      service: 'staff-capabilities',
      version: 'v1',
      browserUseConfigured: browserConfigured(),
      capabilities: [
        'web.restaurant.reserve',
        'web.appointment.search',
      ],
      privacyModes: {
        nexa: 'federated_action_audit',
        healthwallet: 'ephemeral_web_search',
        mydatamed: 'ephemeral_web_search',
      },
    })
  }

  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  try {
    if (!browserConfigured()) {
      return json(503, {
        code: 'BROWSER_USE_NOT_CONFIGURED',
        error: 'A execução web ainda não está configurada.',
      })
    }

    const auth = await authorize(request)
    if (!auth) return json(401, { error: 'unauthorized' })

    const payload = await request.json().catch(() => ({}))
    const operation = String(payload?.operation || 'route')
    const message = String(payload?.message || '').trim().slice(0, 12000)
    const capability = String(payload?.capability || '').trim()
    const profile = (payload?.profile && typeof payload.profile === 'object'
      ? payload.profile
      : {}) as FederatedProfile

    if (!message && operation !== 'status') {
      return json(400, { error: 'message_required' })
    }

    if (auth.sourceApp === 'nexa') {
      if (operation !== 'route' && operation !== 'invoke') {
        return json(400, { error: 'unsupported_operation' })
      }
      const result = await routeNexa(request, auth.subjectId, message, profile)
      return json(200, result as Record<string, unknown>)
    }

    if (capability !== 'web.appointment.search') {
      return json(403, { error: 'unsupported_scope' })
    }

    const result = await invokeHealthAppointmentSearch(message, payload?.consent === true)
    return json(200, result as Record<string, unknown>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'capability_gateway_failed'
    console.error('staff-capabilities', message.slice(0, 300))
    if (message === 'RESERVATION_PROFILE_INCOMPLETE') {
      return json(409, { error: message, status: 'needs_profile' })
    }
    if (message === 'BROWSER_USE_API_KEY_NOT_CONFIGURED') {
      return json(503, { error: message })
    }
    return json(500, { error: 'capability_gateway_failed' })
  }
}
