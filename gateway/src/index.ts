import { Hono, type Context, type MiddlewareHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
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
  POLAR_WEBHOOK_SECRET: string
  POLAR_ACCESS_TOKEN: string
  POLAR_API_URL: string
  SETU_CLIENT_ID: string
  SETU_CLIENT_SECRET: string
  SETU_PRODUCT_INSTANCE_ID: string
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

// Self-verifying OAuth state: id.provider.intent.exp.hex-sig — no KV read-after-write race (KV is only globally consistent within ~60s).
async function signState(c: { env: { WORKER_AUTH_SECRET: string } }, provider: string, intent: string): Promise<string> {
  const id = randomHex()
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL
  const sig = await sha256Hex(`${id}.${provider}.${intent}.${exp}.${c.env.WORKER_AUTH_SECRET}`)
  return `${id}.${provider}.${intent}.${exp}.${sig}`
}

async function verifyState(c: { env: { WORKER_AUTH_SECRET: string } }, state: string): Promise<{ provider: string; intent: string } | null> {
  const parts = state.split('.')
  if (parts.length !== 5) return null
  const [id, provider, intent, expStr, sig] = parts
  if (!['signin', 'signup'].includes(intent)) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
  const expected = await sha256Hex(`${id}.${provider}.${intent}.${exp}.${c.env.WORKER_AUTH_SECRET}`)
  return expected === sig ? { provider, intent } : null
}

const app = new Hono<{ Bindings: Env; Variables: { session: Session; sessionToken: string; aiModel?: string } }>()

async function sha256Hex(input: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: ArrayBuffer | ArrayBufferView, message: string): Promise<string> {
  const keyBytes = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', keyBytes, new TextEncoder().encode(message))
  let bin = ''
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Standard Webhooks spec (as used by Polar): signature = "v1," + base64(HMAC-SHA256(key, `${webhookId}.${timestamp}.${rawBody}`))
// HMAC key convention varies by SDK; try both the raw secret and its base64-decoded form.
async function verifyPolarWebhook(secret: string, webhookId: string, timestamp: string, rawBody: string, signature: string): Promise<boolean> {
  const message = `${webhookId}.${timestamp}.${rawBody}`
  const keys = [new TextEncoder().encode(secret)]
  try {
    keys.push(Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)))
  } catch {
    // not valid base64 — only raw form applies
  }
  for (const key of keys) {
    const expected = `v1,${await hmacSha256(key, message)}`
    if (constantTimeEqual(signature, expected)) return true
  }
  return false
}

const FIP_NAMES: Record<string, string> = {
  'setu-fip': 'Setu FIP (Sandbox)',
  'setu-fip-2': 'Setu FIP-2 (Sandbox)',
  'HDFC-FIP': 'HDFC Bank',
  'SBI-FIP': 'State Bank of India',
  'ICICI-FIP': 'ICICI Bank',
  'CAMS-FIP': 'CAMS (MF)',
  'LIC-FIP': 'LIC',
  'ICICI-INS-FIP': 'ICICI Insurance',
  'MULTIPLE': 'Multiple FIPs',
}

function fipIdToBankName(fipId: string): string {
  return FIP_NAMES[fipId] ?? fipId
}

// ── Setu AA helpers ────────────────────────────────────────────────────────

const SETU_AUTH_URL = 'https://uat.setu.co/api/v2/auth/token'
const SETU_BASE_URL = 'https://fiu-sandbox.setu.co'

async function getSetuToken(c: { env: { BACKEND_URL: string; BACKEND_SECRET: string; SETU_CLIENT_ID: string; SETU_CLIENT_SECRET: string; SESSIONS: KVNamespace } }): Promise<string> {
  const cached = await c.env.SESSIONS.get('setu:token')
  if (cached) return cached

  const res = await setuProxy(c, SETU_AUTH_URL, 'POST', { 'Content-Type': 'application/json' }, { clientID: c.env.SETU_CLIENT_ID, secret: c.env.SETU_CLIENT_SECRET })
  if (!res.ok) throw new Error(`Setu auth error ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { data?: { token?: string; expiresIn?: number } }
  const token = data?.data?.token
  if (!token) throw new Error('No token in Setu auth response')
  // Cache for 25 minutes (token lives 30 min)
  await c.env.SESSIONS.put('setu:token', token, { expirationTtl: 1500 })
  return token
}

async function setuProxy(
  c: { env: { BACKEND_URL: string; BACKEND_SECRET: string } },
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<Response> {
  // Setu APIs are only reachable from Indian IPs; Cloudflare Workers egress is
  // not. Route Setu traffic through the EC2 backend (ap-south-1).
  return fetch(`${c.env.BACKEND_URL}/setu-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cartis-backend-secret': c.env.BACKEND_SECRET,
    },
    body: JSON.stringify({ method, url, headers, body }),
  })
}

async function setuFetch(c: { env: { BACKEND_URL: string; BACKEND_SECRET: string; SETU_CLIENT_ID: string; SETU_CLIENT_SECRET: string; SETU_PRODUCT_INSTANCE_ID: string; SESSIONS: KVNamespace } }, path: string, method = 'GET', body?: unknown) {
  const token = await getSetuToken(c)
  const res = await setuProxy(c, `${SETU_BASE_URL}${path}`, method, {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-product-instance-id': c.env.SETU_PRODUCT_INSTANCE_ID,
  }, body)
  const json = await res.json() as Record<string, unknown>
  if (!res.ok || json.errorCode) {
    throw new Error(`Setu API error ${res.status}: ${JSON.stringify(json)}`)
  }
  return json
}

function parseSetuFetch(sessionData: Record<string, unknown>): { accounts: { maskedAccNumber: string; bankName: string; balance: number; fipId: string }[]; transactions: { txnId: string; txnType: string; amount: number; narration: string; timestamp: string }[] } {
  const fips = (sessionData.fips ?? []) as { fipID?: string; accounts?: { linkRefNumber?: string; maskedAccNumber?: string; data?: Record<string, unknown> }[] }[]
  const accounts: { maskedAccNumber: string; bankName: string; balance: number; fipId: string }[] = []
  const transactions: { txnId: string; txnType: string; amount: number; narration: string; timestamp: string }[] = []

  for (const fip of fips) {
    const fipId = fip.fipID ?? ''
    for (const acct of fip.accounts ?? []) {
      const acctData = acct.data?.account as Record<string, unknown> | undefined
      if (!acctData) continue
      const summary = acctData.summary as Record<string, unknown> | undefined
      const balance = summary?.currentBalance ? parseFloat(summary.currentBalance as string) : 0

      accounts.push({
        maskedAccNumber: acct.maskedAccNumber ?? '',
        bankName: fipIdToBankName(fipId),
        balance: Number.isFinite(balance) ? balance : 0,
        fipId,
      })

      const txContainer = acctData.transactions as { transaction?: Record<string, unknown>[] } | undefined
      const txns = txContainer?.transaction ?? []
      for (const tx of txns) {
        transactions.push({
          txnId: (tx.txnId as string) ?? `${tx.narration}-${tx.amount}-${tx.transactionTimestamp}`,
          txnType: tx.type === 'CREDIT' ? 'credit' : 'debit',
          amount: parseFloat(tx.amount as string) || 0,
          narration: (tx.narration as string) ?? '',
          timestamp: (tx.transactionTimestamp as string) ?? '',
        })
      }
    }
  }

  return { accounts, transactions }
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

async function createSession(c: Context<{ Bindings: Env; Variables: { session: Session; sessionToken: string } }>, user: { user_id: string; email: string; name: string; avatar: string; provider: string }) {
  const sessionId = randomHex()
  const expiration = Math.floor(Date.now() / 1000) + SESSION_TTL
  const sessionToken = await sha256Hex(sessionId + expiration + c.env.WORKER_AUTH_SECRET)
  const session: Session = {
    session_id: sessionId,
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    provider: user.provider,
    exp: expiration,
    last_rotation: Math.floor(Date.now() / 1000),
  }
  await c.env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), { expirationTtl: SESSION_TTL })
  await addUserSession(c, session.user_id, sessionToken)
  c.header('Set-Cookie', `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`)
  return { session, sessionToken }
}

async function backendGql(
  c: { env: { BACKEND_URL: string; BACKEND_SECRET: string } },
  query: string,
  userId?: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const body: { query: string; variables?: Record<string, unknown> } = { query }
  if (variables) body.variables = variables
  const res = await fetch(`${c.env.BACKEND_URL}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cartis-backend-secret': c.env.BACKEND_SECRET,
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`backend error ${res.status}`)
  return ((await res.json()) as { data?: unknown }).data
}

type SellerGql = {
  sellerDashboard?: {
    revenue: number
    expenses: number
    profitMargin: number
    cashOnHand: number
    lastMonthRevenue: number
    lastMonthExpenses: number
  }
  sellerFinances?: {
    entryType: string
    amount: number
    category: string | null
    description: string | null
    transactionDate: string
  }[]
  sellerCategories?: { name: string; spent: number }[]
  sellerInventory?: { name: string; stock: number; reorderLevel: number; unitCost: number }[]
}

type ConsumerGql = {
  wallet?: { balance: number; tabLimit: number }
  monthlyTab?: { limit: number; spent: number }
  spending30d?: { day: string; spend: number }[]
  bankAccounts?: { bankName: string; balance: number | null }[]
  me?: {
    monthlyIncome: number | null
    monthlySpend: number | null
    investmentPct: number | null
    housingCost: number | null
    dependents: number | null
    debtEmis: number | null
    monthlyTax: number | null
  }
}

const auth: MiddlewareHandler<{ Bindings: Env; Variables: { session: Session; sessionToken: string } }> = async (c, next) => {
  const token = cookieToken(c) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
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

app.get('/login', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.redirect('/auth/start?provider=google')
})

app.get('/auth/login', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.redirect('/auth/start?provider=google')
})

app.get('/auth/start', async (c) => {
  c.header('Cache-Control', 'no-store')
  const provider = c.req.query('provider') ?? 'google'
  if (provider !== 'google') return c.json({ error: `provider '${provider}' not configured` }, 501)
  const intent = c.req.query('intent') === 'signup' ? 'signup' : c.req.query('intent') === 'signin' ? 'signin' : ''
  const state = await signState(c, provider, intent)
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
  c.header('Cache-Control', 'no-store')
  if (c.req.query('error')) return c.redirect('/signin?error=google_denied')
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code || !state) return c.json({ error: 'missing code or state' }, 400)
  const { provider, intent } = (await verifyState(c, state)) ?? {}
  if (!provider) return c.json({ error: 'invalid state' }, 400)

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

  let existing: { googleUserByEmail?: string | null } | null = null
  try {
    existing = (await backendGql(
      c,
      `query { googleUserByEmail(email: ${JSON.stringify(info.email)}) }`,
    )) as { googleUserByEmail?: string | null } | null
  } catch {
    existing = null
  }
  if (intent === 'signin' && !existing?.googleUserByEmail) return c.redirect('/signup?error=no_account')
  if (intent === 'signup' && existing?.googleUserByEmail) return c.redirect('/signin?error=already_exists')

  let data: { upsertGoogleUser?: { userId?: string | null; created?: boolean } | null }
  try {
    data = (await backendGql(
      c,
      `mutation { upsertGoogleUser(email: ${JSON.stringify(info.email)}, fullName: ${JSON.stringify(info.name ?? '')}, avatarUrl: ${JSON.stringify(info.picture ?? '')}) { userId created } }`,
    )) as { upsertGoogleUser?: { userId?: string | null; created?: boolean } | null }
  } catch (e) {
    return c.json({ error: 'user provisioning failed', details: String(e) }, 502)
  }
  const created = data?.upsertGoogleUser?.created
  if (created == null) return c.json({ error: 'user provisioning failed' }, 502)
  const userId = data.upsertGoogleUser?.userId
  if (!userId) return c.json({ error: 'user provisioning failed' }, 502)

  const sessionId = randomHex()
  const expiration = Math.floor(Date.now() / 1000) + SESSION_TTL
  const sessionToken = await sha256Hex(sessionId + expiration + c.env.WORKER_AUTH_SECRET)
  const session: Session = {
    session_id: sessionId,
    user_id: userId,
    email: info.email,
    name: info.name ?? '',
    avatar: info.picture ?? '',
    provider,
    exp: expiration,
    last_rotation: Math.floor(Date.now() / 1000),
  }
  await c.env.SESSIONS.put(`session:${sessionToken}`, JSON.stringify(session), { expirationTtl: SESSION_TTL })
  await addUserSession(c, session.user_id, sessionToken)

  c.header('Set-Cookie', `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`)
  return c.redirect(created ? '/onboarding' : '/dashboard')
})

app.post('/auth/signup', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string; name?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const name = (body.name ?? '').trim()
  if (!email.includes('@') || password.length < 8 || !name) return c.json({ error: 'invalid email, password (min 8 chars), or name' }, 400)
  try {
    const data = (await backendGql(c, `mutation { signup(email: ${JSON.stringify(email)}, fullName: ${JSON.stringify(name)}, password: ${JSON.stringify(password)}) }`)) as {
      signup?: string | null
    }
    if (!data?.signup) return c.json({ error: 'email already registered' }, 409)
    await createSession(c, { user_id: data.signup, email, name, avatar: '', provider: 'password' })
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/auth/login', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!email || !password) return c.json({ error: 'email and password required' }, 400)
  try {
    const data = (await backendGql(c, `mutation { login(email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)}) { userId fullName avatarUrl } }`)) as {
      login?: { userId: string; fullName: string; avatarUrl?: string | null } | null
    }
    if (!data?.login) return c.json({ error: 'invalid email or password' }, 401)
    await createSession(c, { user_id: data.login.userId, email, name: data.login.fullName, avatar: data.login.avatarUrl ?? '', provider: 'password' })
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
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
  return c.redirect('/')
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

app.post('/api/session/refresh', auth, (c) => {
  const session = c.get('session')
  return c.json({
    token: c.get('sessionToken'),
    ttl_ms: SESSION_TTL * 1000,
    user: { id: session.user_id, email: session.email, name: session.name, avatar: session.avatar },
  })
})

app.all('/graphql', auth, async (c) => {
  const target = new URL(`${c.env.BACKEND_URL}/graphql`)
  const qs = c.req.url.split('?')[1]
  if (qs) target.search = qs
  const res = await fetch(target, {
    method: c.req.method,
    headers: {
      'content-type': c.req.header('content-type') ?? 'application/json',
      'x-cartis-backend-secret': c.env.BACKEND_SECRET,
      'x-user-id': c.get('session').user_id,
    },
    body: c.req.method === 'GET' ? undefined : await c.req.text(),
  })
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  })
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

app.post('/api/coach/chat', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    session_id?: string
    mode?: string
    message?: string
  }
  if (!body.message?.trim()) return c.json({ error: 'message required' }, 400)
  try {
    const res = await fetch(`${c.env.BACKEND_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cartis-backend-secret': c.env.BACKEND_SECRET,
        'x-user-id': c.get('session').user_id,
      },
      body: JSON.stringify({ session_id: body.session_id, mode: body.mode, message: body.message }),
    })
    if (!res.ok) {
      const text = await res.text()
      return c.json(
        { error: text || `backend error ${res.status}` },
        res.status as ContentfulStatusCode,
      )
    }
    c.header('content-type', 'text/event-stream')
    c.header('cache-control', 'no-cache')
    return c.body(res.body as unknown as ReadableStream)
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.get('/api/coach/sessions', auth, async (c) => {
  try {
    const res = await fetch(`${c.env.BACKEND_URL}/chat/sessions`, {
      headers: {
        'x-cartis-backend-secret': c.env.BACKEND_SECRET,
        'x-user-id': c.get('session').user_id,
      },
    })
    if (!res.ok) return c.json({ error: `backend error ${res.status}` }, res.status as ContentfulStatusCode)
    return c.json(await res.json())
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/coach/sessions', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { mode?: string }
  try {
    const res = await fetch(`${c.env.BACKEND_URL}/chat/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cartis-backend-secret': c.env.BACKEND_SECRET,
        'x-user-id': c.get('session').user_id,
      },
      body: JSON.stringify({ mode: body.mode }),
    })
    if (!res.ok) return c.json({ error: `backend error ${res.status}` }, res.status as ContentfulStatusCode)
    return c.json(await res.json())
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.get('/api/coach/sessions/:id/messages', auth, async (c) => {
  try {
    const res = await fetch(
      `${c.env.BACKEND_URL}/chat/sessions/${c.req.param('id')}/messages`,
      {
        headers: {
          'x-cartis-backend-secret': c.env.BACKEND_SECRET,
          'x-user-id': c.get('session').user_id,
        },
      },
    )
    if (!res.ok) return c.json({ error: `backend error ${res.status}` }, res.status as ContentfulStatusCode)
    return c.json(await res.json())
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

type CoachInsight = { title: string; detail: string; tone: string }

async function coachInsightsViaBackend(
  c: { env: { BACKEND_URL: string; BACKEND_SECRET: string }; get: (k: 'session') => { user_id: string } },
  role: 'consumer' | 'seller',
  refresh: boolean,
): Promise<{ insights: CoachInsight[]; generatedAt: string } | null> {
  const query = refresh
    ? `mutation { refreshCoachInsights(role: "${role}") { title detail tone } }`
    : `query { coachInsights(role: "${role}") { generatedAt insights { title detail tone } } }`
  const res = await fetch(`${c.env.BACKEND_URL}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cartis-backend-secret': c.env.BACKEND_SECRET,
      'x-user-id': c.get('session').user_id,
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`backend error ${res.status}`)
  const data = (await res.json()) as { data?: any; errors?: { message: string }[] }
  if (data.errors?.length) throw new Error(data.errors[0].message)
  const d = data.data
  if (refresh) return { insights: d.refreshCoachInsights, generatedAt: new Date().toISOString() }
  return d.coachInsights
    ? { insights: d.coachInsights.insights, generatedAt: d.coachInsights.generatedAt }
    : null
}

app.post('/api/seller/coach', auth, async (c) => {
  const refresh = c.req.query('refresh') === '1'
  try {
    let out = await coachInsightsViaBackend(c, 'seller', refresh)
    if (!out) out = await coachInsightsViaBackend(c, 'seller', true)
    return c.json(out)
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/consumer/coach', auth, async (c) => {
  const refresh = c.req.query('refresh') === '1'
  try {
    let out = await coachInsightsViaBackend(c, 'consumer', refresh)
    if (!out) out = await coachInsightsViaBackend(c, 'consumer', true)
    return c.json(out)
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/budget/suggest', auth, async (c) => {
  const userId = c.get('session').user_id
  const cacheKey = `budget:ai:${userId}`
  const cached = await c.env.SESSIONS.get(cacheKey)
  if (cached) return c.json(JSON.parse(cached))

  let data: {
    wallet?: { balance: number; tabLimit: number }
    monthlyTab?: { limit: number; spent: number }
    bankAccounts?: { bankName: string; balance: number | null }[]
    spending30d?: { day: string; spend: number }[]
    me?: {
      monthlyIncome: number | null
      monthlySpend: number | null
      investmentPct: number | null
      housingCost: number | null
      dependents: number | null
      debtEmis: number | null
      monthlyTax: number | null
      aiModel: string | null
    }
  } = {}
  try {
    data = (await backendGql(
      c,
      `query { wallet { balance tabLimit } monthlyTab { limit spent } bankAccounts { bankName balance } spending30d { day spend } me { monthlyIncome monthlySpend investmentPct housingCost dependents debtEmis monthlyTax aiModel } }`,
      userId,
    )) as typeof data
  } catch {
    return c.json({ suggestedLimit: data.monthlyTab?.limit ?? 600, reasoning: 'Could not fetch financial data.' })
  }

  const total30d = data.spending30d?.reduce((s, d) => s + d.spend, 0) ?? 0
  const currentLimit = data.monthlyTab?.limit ?? data.wallet?.tabLimit ?? 600
  const spent = data.monthlyTab?.spent ?? 0
  const balance = data.wallet?.balance ?? 0
  const profile = data.me

  if (total30d === 0 && spent === 0 && !profile?.monthlyIncome) {
    return c.json({ suggestedLimit: currentLimit, reasoning: 'Not enough spending data yet. Keep using Cartis and I\'ll suggest a budget once I see your patterns. Complete onboarding for a personalized budget.' })
  }

  const bankSummary = data.bankAccounts?.map((a) => `${a.bankName}: ₹${a.balance ?? 0}`).join(', ') ?? 'none'

  // Build profile section for the prompt
  let profileSection = ''
  if (profile?.monthlyIncome) {
    const investmentAmt = profile.investmentPct ? Math.round(profile.monthlyIncome * profile.investmentPct / 100) : 0
    const taxAmt = profile.monthlyTax ?? 0
    profileSection = `
User's financial profile (self-declared):
- Monthly income: ₹${profile.monthlyIncome}
- Monthly tax deducted: ₹${taxAmt}
- Estimated monthly spend: ₹${profile.monthlySpend ?? 'unknown'}
- Invests/saves ${profile.investmentPct ?? 0}% of income (₹${investmentAmt}/month)
- Housing/rent cost: ₹${profile.housingCost ?? 0}/month
- Dependents: ${profile.dependents ?? 0}
- Total EMIs/loans: ₹${profile.debtEmis ?? 0}/month

HARD RULE: The suggested budget MUST NOT exceed income - tax - savings - housing - EMIs (₹${profile.monthlyIncome} - ₹${taxAmt} - ₹${investmentAmt} - ₹${profile.housingCost ?? 0} - ₹${profile.debtEmis ?? 0} = ₹${Math.max(500, profile.monthlyIncome - taxAmt - investmentAmt - (profile.housingCost ?? 0) - (profile.debtEmis ?? 0))}).`
  } else {
    profileSection = '\nNo financial profile set. Advise the user to complete onboarding for a more accurate budget.'
  }

  const prompt = `You are Cartis, an AI financial coach for Indian users (₹).

User's financial snapshot:
- Monthly budget (current): ₹${currentLimit}
- Spent this month: ₹${spent}
- Bank balance: ₹${balance}
- Bank accounts: ${bankSummary}
- Spending last 30 days: ₹${total30d}
${profileSection}

Based on this user's actual spending patterns, bank balance, and stated financial profile (if available), recommend a realistic monthly budget limit in INR.

Rules:
- The budget should be achievable — not too aggressive, not too loose
- Consider the wallet buffer (bank balance should cover at least 2-3 months of budget)
- Round to nearest ₹500, minimum ₹500
- If the user is underspending, suggest a tighter budget
- If overspending, suggest a realistic adjustment, not a drastic cut
- If a financial profile is provided, the budget MUST respect the hard cap (income - savings - housing - EMIs)

Return ONLY JSON: { "suggestedLimit": <number>, "reasoning": "<1-2 sentence explanation>" }`

  try {
    const out = (await c.env.AI.run(data.me?.aiModel || '@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'user', content: prompt }],
    })) as { response?: string; choices?: Array<{ message?: { content?: string } }> }
    const content = typeof out.response === 'string' ? out.response : (out.choices?.[0]?.message?.content ?? '')
    if (!content.trim()) throw new Error('empty model output')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON in model output')
    const parsed = JSON.parse(jsonMatch[0]) as { suggestedLimit?: number; reasoning?: string }

    let limit = parsed.suggestedLimit ?? currentLimit
    limit = Math.round(limit / 500) * 500
    limit = Math.max(500, limit)

    // Hard cap: income - tax - savings - housing - EMIs
    if (profile?.monthlyIncome) {
      const investmentAmt = profile.investmentPct ? Math.round(profile.monthlyIncome * profile.investmentPct / 100) : 0
      const taxAmt = profile.monthlyTax ?? 0
      const cap = Math.max(500, profile.monthlyIncome - taxAmt - investmentAmt - (profile.housingCost ?? 0) - (profile.debtEmis ?? 0))
      if (limit > cap) limit = cap
    }

    const reasoning = parsed.reasoning ?? 'Budget adjusted based on your spending patterns.'

    // Apply via backend
    await backendGql(
      c,
      `mutation { setMonthlyTabLimit(limit: ${limit}) { limit } }`,
      userId,
    )

    // Persist suggestion
    await backendGql(
      c,
      `mutation { saveBudgetSuggestion(suggestedLimit: ${limit}, reasoning: "${reasoning.replace(/"/g, '\\"')}", spent: ${spent}, walletBalance: ${balance}) { suggestedLimit reasoning createdAt } }`,
      userId,
    )

    const result = { suggestedLimit: limit, reasoning }
    await c.env.SESSIONS.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 })
    return c.json(result)
  } catch {
    return c.json({ suggestedLimit: currentLimit, reasoning: 'AI could not compute a suggestion right now.' })
  }
})

app.post('/api/subscription/checkout', auth, async (c) => {
  const userId = c.get('session').user_id
  const body = (await c.req.json().catch(() => ({}))) as { productId?: string }
  if (!body.productId) return c.json({ error: 'productId required' }, 400)

  const res = await fetch(`${c.env.POLAR_API_URL}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: body.productId,
      success_url: new URL('/dashboard', c.req.url).toString(),
      metadata: { user_id: userId },
    }),
  })
  if (!res.ok) return c.json({ error: 'checkout creation failed' }, 502)
  const data = (await res.json()) as { url?: string }
  if (!data.url) return c.json({ error: 'no checkout url' }, 502)
  return c.json({ url: data.url })
})

app.post('/webhooks/polar', async (c) => {
  const secret = c.env.POLAR_WEBHOOK_SECRET
  if (!secret) return c.json({ error: 'webhook not configured' }, 500)
  const webhookId = c.req.header('webhook-id')
  const timestamp = c.req.header('webhook-timestamp')
  const signature = c.req.header('webhook-signature')
  if (!webhookId || !timestamp || !signature) return c.json({ error: 'missing webhook headers' }, 400)
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
    return c.json({ error: 'stale webhook' }, 400)
  }
  const raw = await c.req.text()
  if (!(await verifyPolarWebhook(secret, webhookId, timestamp, raw, signature))) {
    return c.json({ error: 'bad signature' }, 401)
  }
  await c.env.SESSIONS.put(`polar:event:${webhookId}`, raw, { expirationTtl: 2592000 })
  const event = JSON.parse(raw) as { type?: string; data?: { id?: string } }
  console.log('[polar]', event.type ?? 'unknown', event.data?.id ?? '')
  return c.json({ ok: true })
})

// Setu posts webhook events (no signature) to the notification URL configured on Bridge.
// Payloads: CONSENT_STATUS_UPDATE (consentId, data.status) and SESSION_STATUS_UPDATE (dataSessionId, data.status).
async function handleSetuWebhook(c: Context<{ Bindings: Env }>) {
  let event: Record<string, unknown>
  try {
    event = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }
  const type = event.type as string
  const status = ((event.data ?? {}) as { status?: string }).status ?? null
  const ts = (event.timestamp as string) ?? new Date().toISOString()
  if (type === 'CONSENT_STATUS_UPDATE') {
    const consentId = event.consentId as string
    if (consentId) {
      await c.env.SESSIONS.put(`setu:consent:${consentId}`, JSON.stringify({ status, timestamp: ts, success: event.success ?? true }), { expirationTtl: 604800 })
    }
  } else if (type === 'SESSION_STATUS_UPDATE') {
    const dataSessionId = event.dataSessionId as string
    if (dataSessionId) {
      await c.env.SESSIONS.put(`setu:session:${dataSessionId}`, JSON.stringify({ status, timestamp: ts, success: event.success ?? true }), { expirationTtl: 604800 })
    }
  }
  console.log('[setu]', type, event.consentId ?? event.dataSessionId ?? '', status)
  return c.json({ ok: true })
}

// ── Account Aggregator (Setu AA) routes ────────────────────────────────────

// Sahamati-standard paths + our own; Bridge config uses the full URL, so the handler is mounted on all three.
app.post('/webhooks/setu', handleSetuWebhook)
app.post('/v1/consents/notify', handleSetuWebhook)
app.post('/v1/fi/notify', handleSetuWebhook)

app.post('/api/aa/consent', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { mobileNumber?: string; fiTypes?: string[] }
  const mobile = body.mobileNumber?.trim()
  if (!mobile || !/^\d{10}$/.test(mobile)) return c.json({ error: 'valid 10-digit mobileNumber required' }, 400)
  const fiTypes = body.fiTypes ?? ['DEPOSIT', 'MUTUAL_FUNDS', 'INSURANCE_POLICIES']

  try {
    const from = new Date(Date.now() - 180 * 86400_000).toISOString()
    const to = new Date().toISOString()

    const consentRes = await setuFetch(c, '/v2/consents', 'POST', {
      consentDuration: { unit: 'MONTH', value: '4' },
      vua: mobile,
      consentMode: 'STORE',
      fetchType: 'ONETIME',
      consentTypes: ['TRANSACTIONS', 'PROFILE', 'SUMMARY'],
      fiTypes,
      purpose: {
        code: '102',
        refUri: 'https://api.rebit.org.in/aa/purpose/102.xml',
        text: 'Customer spending patterns, budget or other reportings',
        category: { type: 'string' },
      },
      dataRange: { from, to },
      dataLife: { unit: 'MONTH', value: 1 },
      frequency: { unit: 'MONTH', value: 1 },
      redirectUrl: new URL('/onboarding', c.req.url).toString(),
    })

    const consentId = consentRes.id as string
    const consentUrl = consentRes.url as string

    await backendGql(
      c,
      `mutation { upsertAaConnection(aaHandle: ${JSON.stringify(mobile)}, consentHandle: ${JSON.stringify(consentId)}) { aaHandle consentStatus } }`,
      c.get('session').user_id,
    )

    return c.json({ consentId, consentUrl, status: 'PENDING' })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.get('/api/aa/status/:consentId', auth, async (c) => {
  const consentId = c.req.param('consentId')
  if (!consentId) return c.json({ error: 'consentId required' }, 400)

  const cached = await c.env.SESSIONS.get(`setu:consent:${consentId}`)
  if (cached) {
    const ev = JSON.parse(cached) as { status: string; timestamp: string }
    return c.json({ consentStatus: ev.status, consentId, cached: true, timestamp: ev.timestamp })
  }

  try {
    const res = await setuFetch(c, `/v2/consents/${consentId}`)
    const status = res.status as string
    const detail = res.detail as Record<string, unknown> | undefined
    const accountsLinked = (res.accountsLinked ?? []) as { maskedAccNumber?: string; fipId?: string; accType?: string; linkRefNumber?: string }[]

    return c.json({
      consentStatus: status,
      consentId,
      accounts: accountsLinked.map((a) => ({
        maskedAccNumber: a.maskedAccNumber ?? '',
        fipId: a.fipId ?? '',
        accType: a.accType ?? '',
        linkRefNumber: a.linkRefNumber ?? '',
      })),
    })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/aa/fetch', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { consentId?: string }
  const { consentId } = body
  if (!consentId) return c.json({ error: 'consentId required' }, 400)

  try {
    const userId = c.get('session').user_id

    // Step 1: Create data session
    const from = new Date(Date.now() - 180 * 86400_000).toISOString()
    const to = new Date().toISOString()

    const sessionRes = await setuFetch(c, '/v2/sessions', 'POST', {
      consentId,
      dataRange: { from, to },
      format: 'json',
    })
    const dataSessionId = sessionRes.id as string
    if (!dataSessionId) return c.json({ error: 'no data session id from Setu' }, 502)

    // Step 2: Poll for data readiness (max 30s)
    let sessionData: Record<string, unknown> | null = null
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const pollRes = await setuFetch(c, `/v2/sessions/${dataSessionId}`)
      const pollStatus = pollRes.status as string
      if (pollStatus === 'COMPLETED' || pollStatus === 'PARTIAL') {
        sessionData = pollRes
        break
      }
      if (pollStatus === 'FAILED' || pollStatus === 'EXPIRED') {
        return c.json({ error: `Data session ${pollStatus.toLowerCase()}` }, 502)
      }
    }

    if (!sessionData) return c.json({ error: 'Data session timed out (30s)' }, 502)

    // Step 3: Parse FI data
    const { accounts, transactions } = parseSetuFetch(sessionData)

    // Step 4: Sync to backend
    const syncRes = await backendGql(
      c,
      `mutation SyncAa($aaHandle: String!, $consentId: String!, $accounts: [AaAccountInput!]!, $transactions: [AaTxInput!]!) {
        syncAaData(aaHandle: $aaHandle, consentId: $consentId, accounts: $accounts, transactions: $transactions) {
          inserted balance accountId
        }
      }`,
      userId,
      { aaHandle: consentId, consentId, accounts, transactions },
    ) as { syncAaData?: { inserted: number; balance: number | null; accountId: string | null } }

    return c.json({
      ok: true,
      accounts,
      balance: syncRes?.syncAaData?.balance ?? accounts[0]?.balance ?? null,
      transactionCount: syncRes?.syncAaData?.inserted ?? transactions.length,
    })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/aa/reconnect', auth, async (c) => {
  const userId = c.get('session').user_id
  try {
    const connData = (await backendGql(
      c,
      `query { aaConnections { aaHandle consentId consentStatus } }`,
      userId,
    )) as { aaConnections?: { aaHandle: string; consentId: string; consentStatus: string }[] }

    const conn = connData?.aaConnections?.[0]
    if (!conn || !conn.consentId) return c.json({ error: 'no active AA connection' }, 400)

    // Create new data session against existing consent
    const from = new Date(Date.now() - 180 * 86400_000).toISOString()
    const to = new Date().toISOString()

    const sessionRes = await setuFetch(c, '/v2/sessions', 'POST', {
      consentId: conn.consentId,
      dataRange: { from, to },
      format: 'json',
    })
    const dataSessionId = sessionRes.id as string
    if (!dataSessionId) return c.json({ error: 'no data session id' }, 502)

    // Poll for data readiness
    let sessionData: Record<string, unknown> | null = null
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const pollRes = await setuFetch(c, `/v2/sessions/${dataSessionId}`)
      const pollStatus = pollRes.status as string
      if (pollStatus === 'COMPLETED' || pollStatus === 'PARTIAL') {
        sessionData = pollRes
        break
      }
      if (pollStatus === 'FAILED' || pollStatus === 'EXPIRED') {
        return c.json({ error: `Data session ${pollStatus.toLowerCase()}` }, 502)
      }
    }

    if (!sessionData) return c.json({ error: 'Data session timed out (30s)' }, 502)

    const { accounts, transactions } = parseSetuFetch(sessionData)

    const syncRes = await backendGql(
      c,
      `mutation SyncAa($aaHandle: String!, $consentId: String!, $accounts: [AaAccountInput!]!, $transactions: [AaTxInput!]!) {
        syncAaData(aaHandle: $aaHandle, consentId: $consentId, accounts: $accounts, transactions: $transactions) {
          inserted balance accountId
        }
      }`,
      userId,
      { aaHandle: conn.aaHandle, consentId: conn.consentId, accounts, transactions },
    ) as { syncAaData?: { inserted: number; balance: number | null } }

    return c.json({
      ok: true,
      accounts,
      balance: syncRes?.syncAaData?.balance ?? accounts[0]?.balance ?? null,
      transactionCount: syncRes?.syncAaData?.inserted ?? transactions.length,
    })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

// ── Catch-all asset handler ─────────────────────────────────────────────────

app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (!res.headers.get('content-type')?.includes('text/html')) return res
  return new Response(res.body, { status: res.status, headers: { ...res.headers, 'Cache-Control': 'no-store' } })
})

export default app
