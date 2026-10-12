import {
  cleanupBrowserSession,
  hostMatches,
  parseRunOutput,
  safeHttpsUrl,
  waitForRun,
} from './_shared/staff-capabilities-core.mts'
import {
  env,
  getFederatedAction,
  updateFederatedAction,
} from './_shared/staff-capability-store.mts'

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function bearer(request: Request) {
  const raw = String(request.headers.get('authorization') || '')
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : ''
}

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const internalKey = env('STAFF_CAPABILITIES_INTERNAL_KEY') || env('STAFF_NEXA_SERVICE_KEY')
    if (!internalKey) return json({ error: 'worker_not_configured' }, 503)
    if (!bearer(request) || bearer(request) !== internalKey) {
      return json({ error: 'unauthorized' }, 401)
    }

    const payload = await request.json().catch(() => ({}))
    const actionId = String(payload?.actionId || '').trim()
    const sourceApp = String(payload?.sourceApp || '').trim()
    const subjectId = String(payload?.subjectId || '').trim()

    if (!actionId || !sourceApp || !subjectId) {
      return json({ error: 'invalid_worker_payload' }, 400)
    }

    const action = await getFederatedAction(sourceApp, subjectId, actionId)
    if (!action || !action.external_task_id) {
      return json({ error: 'action_not_found' }, 404)
    }

    const phase = String(action.result_json?.phase || 'discovery')
    const waited = await waitForRun(action.external_task_id)
    const result = parseRunOutput(waited.run)

    if (waited.status !== 'completed') {
      await cleanupBrowserSession(action.external_session_id)
      const cancelled = waited.status === 'cancelled'
      await updateFederatedAction(action.id, {
        status: cancelled ? 'cancelled' : 'failed',
        external_task_id: null,
        external_session_id: null,
        error_message: String((waited.run as any)?.error || 'browser_run_failed').slice(0, 1000),
      })
      return json({ ok: true, terminal: true, status: cancelled ? 'cancelled' : 'failed' })
    }

    await cleanupBrowserSession(action.external_session_id)

    if (phase === 'discovery') {
      const status = String(result.status || '')
      const summary = String(result.summary || '').slice(0, 3000)

      if (status === 'ready_to_book') {
        if (!safeHttpsUrl(result.bookingUrl)) {
          await updateFederatedAction(action.id, {
            status: 'failed',
            external_task_id: null,
            external_session_id: null,
            result_summary: summary,
            result_json: { phase: 'failed', discovery: result, browserApi: 'v4' },
            error_message: 'booking_url_invalid',
          })
          return json({ ok: true, terminal: true, status: 'failed' })
        }

        await updateFederatedAction(action.id, {
          status: 'needs_confirmation',
          external_task_id: null,
          external_session_id: null,
          result_summary: summary,
          result_json: {
            phase: 'discovery',
            discovery: result,
            confirmationKind: 'confirm_booking',
            browserApi: 'v4',
          },
        })
        return json({ ok: true, terminal: true, status: 'needs_confirmation' })
      }

      if (status === 'alternatives') {
        await updateFederatedAction(action.id, {
          status: 'needs_confirmation',
          external_task_id: null,
          external_session_id: null,
          result_summary: summary,
          result_json: {
            phase: 'discovery',
            discovery: result,
            confirmationKind: 'alternative_time',
            browserApi: 'v4',
          },
        })
        return json({ ok: true, terminal: true, status: 'needs_confirmation' })
      }

      if (status === 'needs_input') {
        await updateFederatedAction(action.id, {
          status: 'needs_confirmation',
          external_task_id: null,
          external_session_id: null,
          result_summary: summary,
          result_json: {
            phase: 'discovery',
            discovery: result,
            confirmationKind: 'clarification',
            browserApi: 'v4',
          },
        })
        return json({ ok: true, terminal: true, status: 'needs_confirmation' })
      }

      if (status === 'not_found') {
        await updateFederatedAction(action.id, {
          status: 'completed',
          external_task_id: null,
          external_session_id: null,
          result_summary: summary,
          result_json: { phase: 'completed', discovery: result, browserApi: 'v4' },
        })
        return json({ ok: true, terminal: true, status: 'completed' })
      }

      await updateFederatedAction(action.id, {
        status: 'failed',
        external_task_id: null,
        external_session_id: null,
        result_summary: summary,
        result_json: { phase: 'failed', discovery: result, browserApi: 'v4' },
        error_message: String(result.summary || 'discovery_failed').slice(0, 1000),
      })
      return json({ ok: true, terminal: true, status: 'failed' })
    }

    const bookingStatus = String(result.status || '')
    const bookingHost = String(action.result_json?.bookingHost || '')
    const finalUrl = safeHttpsUrl(result.finalUrl)
    const finalHostValid = !finalUrl || !bookingHost || hostMatches(finalUrl.hostname, bookingHost)
    const summary = String(result.summary || result.reason || '').slice(0, 3000)

    if (bookingStatus === 'booked' && finalHostValid) {
      await updateFederatedAction(action.id, {
        status: 'completed',
        external_task_id: null,
        external_session_id: null,
        result_summary: summary,
        result_json: { phase: 'completed', reservation: result, browserApi: 'v4' },
      })
      return json({ ok: true, terminal: true, status: 'completed' })
    }

    if (bookingStatus === 'needs_user' || (bookingStatus === 'booked' && !finalHostValid)) {
      const reason = !finalHostValid
        ? 'A navegação terminou fora do domínio validado. A automação foi interrompida por segurança.'
        : summary || 'A reserva chegou a uma etapa que precisa do usuário.'

      await updateFederatedAction(action.id, {
        status: 'needs_confirmation',
        external_task_id: null,
        external_session_id: null,
        result_summary: reason,
        result_json: {
          ...action.result_json,
          phase: 'booking',
          booking: result,
          confirmationKind: 'manual_takeover',
          browserApi: 'v4',
        },
      })
      return json({ ok: true, terminal: true, status: 'needs_confirmation' })
    }

    await updateFederatedAction(action.id, {
      status: 'failed',
      external_task_id: null,
      external_session_id: null,
      result_summary: summary,
      result_json: { phase: 'failed', booking: result, browserApi: 'v4' },
      error_message: String(result.reason || result.summary || 'booking_failed').slice(0, 1000),
    })
    return json({ ok: true, terminal: true, status: 'failed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'worker_failed'
    console.error('staff-capabilities-worker', message.slice(0, 500))
    return json({ error: 'worker_failed' }, 500)
  }
}

export const config = {
  background: true,
}
