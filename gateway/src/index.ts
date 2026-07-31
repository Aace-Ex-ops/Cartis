import { Hono, type MiddlewareHandler } from 'hono'
import { analyzeProduct, type ScrapedProduct } from './coach'

type Env = {
  SESSIONS: KVNamespace
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  WORKER_AUTH_SECRET: string
  ASSETS: Fetcher
  AI: Ai
  BACKEND_URL: string
  BACKEND_SECRET: string
}

type Session = {
  session_id: string
  user_id: string
  email: string
  name: string
  avatar: string
  provider: string
  exp: number
  last_rotation: number
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const SESSION_TTL = 604800
const STATE_TTL = 600
const ROTATION_SECONDS = 600

const app = new Hono<{ Bindings: Env; Variables: { session: Session; sessionToken: string } }>()

async function sha256Hex(input: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function cookieToken(c: { req: { header: (n: string) => string | undefined } }) {
  return c.req.header('cookie')?.match(/session=([^;]+)/)?.[1]
}

async function userSessions(c: { env: { SESSIONS: KVNamespace; WORKER_AUTH_SECRET: string } }, userId: string): Promise<string[]> {
  return JSON.parse((await c.env.SESSIONS.get(`user_sessions:${userId}`)) ?? '[]')
}

async function addUserSession(c: { env: { SESSIONS: KVNamespace; WORKER_AUTH_SECRET: string } }, userId: string, token: string) {
  const list = await userSessions(c, userId)
  if (!list.includes(token)) {
    list.push(token)
    await c.env.SESSIONS.put(`user_sessions:${userId}`, JSON.stringify(list))
  }
}

async function removeUserSession(c: { env: { SESSIONS: KVNamespace; WORKER_AUTH_SECRET: string } }, userId: string, token: string) {
  const list = await userSessions(c, userId)
  await c.env.SESSIONS.put(
    `user_sessions:${userId}`,
    JSON.stringify(list.filter((t) => t !== token))
  )
}

async function rotateSession(c: { env: { SESSIONS: KVNamespace; WORKER_AUTH_SECRET: string } }, session: Session, token: string) {
  const now = Math.floor(Date.now() / 1000)
  if (now - session.last_rotation < ROTATION_SECONDS) return null
  const newSessionId = randomHex()
  const newToken = await sha256Hex(newSessionId + session.exp + c.env.WORKER_AUTH_SECRET)
  const newSession = { ...session, session_id: newSessionId, last_rotation: now }
  await c.env.SESSIONS.put(`session:${newToken}`, JSON.stringify(newSession), { expirationTtl: SESSION_TTL })
  await c.env.SESSIONS.delete(`session:${token}`)
  await removeUserSession(c, session.user_id, token)
  await addUserSession(c, session.user_id, newToken)
  return { newSession, newToken }
}

const auth: MiddlewareHandler<{ Bindings: Env; Variables: { session: Session; sessionToken: string } }> = async (c, next) => {
  const token = cookieToken(c)
  if (!token) return c.json({ error: 'unauthenticated' }, 401)
  const raw = await c.env.SESSIONS.get(`session:${token}`)
  if (!raw) return c.json({ error: 'unauthenticated' }, 401)
  const session = JSON.parse(raw) as Session
  if (session.exp < Math.floor(Date.now() / 1000)) {
    await c.env.SESSIONS.delete(`session:${token}`)
    await removeUserSession(c, session.user_id, token)
    return c.json({ error: 'session expired' }, 401)
  }
  const rotated = await rotateSession(c, session, token)
  if (rotated) {
    c.set('session', rotated.newSession)
    c.set('sessionToken', rotated.newToken)
    c.header('Set-Cookie', `session=${rotated.newToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`)
  } else {
    c.set('session', session)
    c.set('sessionToken', token)
  }
  await next()
}

app.get('/', (c) => c.json({ status: 'ok', service: 'cartis-gateway' }))

app.get('/health', (c) => c.json({ status: 'ok' }))

app.get('/auth/login', async (c) => {
  const provider = c.req.query('provider') ?? 'google'
  if (provider !== 'google') return c.json({ error: `provider '${provider}' not configured` }, 501)
  const state = randomHex()
  await c.env.SESSIONS.put(`state:${state}`, provider, { expirationTtl: STATE_TTL })
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: new URL('/auth/callback', c.req.url).toString(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return c.redirect(`${GOOGLE_AUTH_URL}?${params}`)
})

app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code || !state) return c.json({ error: 'missing code or state' }, 400)
  const stored = await c.env.SESSIONS.get(`state:${state}`)
  if (!stored) return c.json({ error: 'invalid state' }, 400)
  await c.env.SESSIONS.delete(`state:${state}`)

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL('/auth/callback', c.req.url).toString(),
      grant_type: 'authorization_code',
    }),
  })
  const token = (await tokenRes.json()) as { access_token?: string }
  if (!tokenRes.ok || !token.access_token) return c.json({ error: 'token exchange failed', details: token }, 401)

  const infoRes = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } })
  const info = (await infoRes.json()) as { email?: string; sub?: string; name?: string; picture?: string }
  if (!infoRes.ok || !info.email || !info.sub) return c.json({ error: 'userinfo failed', details: info }, 401)

  const sessionId = randomHex()
  const expiration = Math.floor(Date.now() / 1000) + SESSION_TTL
  const sessionToken = await sha256Hex(sessionId + expiration + c.env.WORKER_AUTH_SECRET)
  const session: Session = {
    session_id: sessionId,
    user_id: info.sub,
    email: info.email,
    name: info.name ?? '',
    avatar: info.picture ?? '',
    provider: stored,
    exp: expiration,
    last_rotation: Math.floor(Date.now() / 1000),
  }
  await c.env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), { expirationTtl: SESSION_TTL })
  await addUserSession(c, session.user_id, sessionToken)

  c.header('Set-Cookie', `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`)
  return c.redirect('/dashboard')
})

app.get('/auth/me', auth, (c) => {
  const session = c.get('session')
  return c.json({ user: { id: session.user_id, email: session.email, name: session.name, avatar: session.avatar } })
})

app.get('/auth/logout', auth, async (c) => {
  const session = c.get('session')
  const sessionToken = c.get('sessionToken')
  await c.env.SESSIONS.delete(`session:${sessionToken}`)
  await removeUserSession(c, session.user_id, sessionToken)
  c.header('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
  return c.json({ ok: true })
})

app.get('/auth/sessions', auth, async (c) => {
  const session = c.get('session')
  const tokens = await userSessions(c, session.user_id)
  const sessions: Array<Record<string, unknown>> = []
  for (const token of tokens) {
    const raw = await c.env.SESSIONS.get(`session:${token}`)
    if (!raw) continue
    const s = JSON.parse(raw) as Session
    sessions.push({ session_id: s.session_id, last_rotation: s.last_rotation, exp: s.exp })
  }
  return c.json({ sessions })
})

app.delete('/auth/sessions/:sessionId', auth, async (c) => {
  const session = c.get('session')
  const target = c.req.param('sessionId')
  const tokens = await userSessions(c, session.user_id)
  for (const token of tokens) {
    const raw = await c.env.SESSIONS.get(`session:${token}`)
    if (!raw) continue
    const s = JSON.parse(raw) as Session
    if (s.session_id === target) {
      await c.env.SESSIONS.delete(`session:${token}`)
      await removeUserSession(c, session.user_id, token)
      return c.json({ ok: true, revoked: target })
    }
  }
  return c.json({ error: 'session not found' }, 404)
})

type ParsedTx = {
  type: 'debit' | 'credit'
  amount: number
  account_last4?: string
  balance?: number
  date?: string
  payee?: string
  raw: string
}

function num(s?: string): number | undefined {
  if (!s) return undefined
  const n = parseFloat(s.replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function parseWithRegex(text: string): ParsedTx[] {
  const txs: ParsedTx[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const joined = lines.join('\n')
  const re = /(?:UPI[:\s-]*|NEFT|IMPS|RTGS)?\s*(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s*(debited from|credited to|sent to|received from|debited by|credit to)\s*(?:A\/C|account|from)?\s*\*{0,2}(\d{4})?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(joined))) {
    const amount = num(m[1])
    if (amount === undefined) continue
    const type = /debited|sent/i.test(m[2]) ? 'debit' : 'credit'
    const lineStart = m.index
    let lineEnd = joined.indexOf('\n', lineStart)
    if (lineEnd < 0) lineEnd = joined.length
    const line = joined.slice(lineStart, lineEnd)
    const balLine = line + ' ' + joined.slice(lineEnd + 1, joined.indexOf('\n', lineEnd + 1) >= 0 ? joined.indexOf('\n', lineEnd + 1) : joined.length)
    const balMatch = balLine.match(/Bal(?:ance)?:?\s*Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i)
    const dateMatch = line.match(/\b(\d{1,2}-[A-Za-z]{3}-\d{2,4}|\d{1,2}-[A-Za-z]{3}|\d{2}[/-]\d{2}[/-]\d{2,4})\b/)
    const payeeMatch = line.match(/(?:to|from|by)[:\s]+([A-Z0-9][A-Za-z0-9 .&-]{2,})/gi)
    let payee: string | undefined
    for (const pm of payeeMatch ?? []) {
      let p = pm.split(/\s+(?:on|at|via|by|Bal)\b/)[0].replace(/^(?:to|from|by)[:\s]+/i, '')
      if (/^(A\/C|account|a\/c)\b/i.test(p) || /^Bal/.test(p)) continue
      p = p.replace(/[.\s]+$/, '')
      payee = p
      break
    }
    txs.push({
      type,
      amount,
      account_last4: m[3] ?? undefined,
      balance: balMatch ? num(balMatch[1]) : undefined,
      date: dateMatch?.[1],
      payee,
      raw: line,
    })
  }
  return txs
}

app.post('/api/sync/parse', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string }
  const text = (body.text ?? '').trim()
  if (!text) return c.json({ error: 'text is required' }, 400)

  let transactions = parseWithRegex(text)
  let source: 'regex' | 'ai' = 'regex'
  if (transactions.length === 0) {
    try {
      const prompt = `Extract bank SMS alerts into a JSON array. Each item: {"type":"debit"|"credit","amount":<number>,"account_last4":<string|null>,"balance":<number|null>,"date":<string|null>,"payee":<string|null>}. Output ONLY the JSON array, no markdown.\n\nSMS:\n${text}`
      const out = (await c.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', { messages: [{ role: 'user', content: prompt }] })) as {
        response?: string
        choices?: Array<{ message?: { content?: string } }>
      }
      const content =
        typeof out.response === 'string'
          ? out.response
          : (out.choices?.[0]?.message?.content ?? '')
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as ParsedTx[]
          transactions = parsed.filter((t) => typeof t.amount === 'number')
          source = 'ai'
        } catch {
          transactions = []
        }
      }
    } catch (e) {
      return c.json({ transactions: [], source: 'none', count: 0, error: String(e) }, 502)
    }
  }

  if (transactions.length === 0) return c.json({ transactions: [], source, count: 0, note: 'nothing recognized — check the message format', version: 'payee-v2' })
  return c.json({ transactions, source, count: transactions.length, version: 'payee-v2' })
})

app.post('/api/coach/analyze', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { product?: ScrapedProduct }
  const p = body.product
  if (!p || !p.name || typeof p.price !== 'number') return c.json({ error: 'product with name and price is required' }, 400)
  try {
    const verdict = await analyzeProduct(c.env, p)
    return c.json(verdict)
  } catch (e) {
    return c.json({ error: String(e) }, 422)
  }
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
