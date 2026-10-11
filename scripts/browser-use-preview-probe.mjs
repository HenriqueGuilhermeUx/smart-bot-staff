const context = String(process.env.CONTEXT || '')
if (context !== 'deploy-preview') {
  console.log('Browser Use preview probe: skipped outside deploy-preview.')
  process.exit(0)
}

const apiKey = String(process.env.BROWSER_USE_API_KEY || '').trim()
if (!apiKey) {
  console.error('Browser Use preview probe: BROWSER_USE_API_KEY missing in deploy-preview context.')
  process.exit(1)
}

const base = 'https://api.browser-use.com/api/v4'
const headers = {
  'X-Browser-Use-API-Key': apiKey,
  'Content-Type': 'application/json',
}

async function request(path, init = {}) {
  const response = await fetch(base + path, { ...init, headers: { ...headers, ...(init.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Browser Use HTTP ${response.status}: ${typeof body?.detail === 'string' ? body.detail : JSON.stringify(body).slice(0, 500)}`)
  }
  return body
}

const created = await request('/runs', {
  method: 'POST',
  body: JSON.stringify({
    task: 'Open https://example.com and return exactly the text STAFF_BROWSER_OK.',
    model: 'gpt-5.6-luna',
    browserSettings: { record: false },
    agentmail: false,
    maxCostUsd: 0.10,
  }),
})

if (!created?.id) throw new Error('Browser Use preview probe: run id missing.')

let status = 'queued'
for (let i = 0; i < 24; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const result = await request(`/runs/${encodeURIComponent(created.id)}/status`)
  status = String(result?.status || '')
  if (['completed', 'failed', 'cancelled'].includes(status)) break
}

if (status !== 'completed') {
  try { await request(`/runs/${encodeURIComponent(created.id)}/cancel`, { method: 'POST' }) } catch {}
  throw new Error(`Browser Use preview probe did not complete successfully: ${status || 'unknown'}`)
}

const run = await request(`/runs/${encodeURIComponent(created.id)}`)
const text = String(run?.result || run?.output || '')
if (!text.includes('STAFF_BROWSER_OK')) {
  throw new Error('Browser Use preview probe completed but returned an unexpected result.')
}

console.log('Browser Use preview probe: PASS (key accepted and hosted run completed).')
