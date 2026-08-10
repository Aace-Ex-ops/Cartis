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
  EXA_API_KEY?: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  YODLEE_CLIENT_ID: string
  YODLEE_SECRET: string
  YODLEE_ADMIN_LOGIN: string
  YODLEE_TEST_LOGIN: string
  YODLEE_BASE_URL: string
  YODLEE_FASTLINK_URL: string
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

// ── Setu proxy (stock tool only) ───────────────────────────────────────────

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

// ── Yodlee (Envestnet) helpers ──────────────────────────────────────────────
// Client-credentials auth (RFC 6749): POST /auth/token with clientId+secret +
// loginName header -> 30-min bearer token, scoped to that loginName.
// Sandbox: 5 preconfigured test users, so all Cartis users share YODLEE_TEST_LOGIN.

async function yodleeToken(
  c: { env: { YODLEE_CLIENT_ID: string; YODLEE_SECRET: string; YODLEE_BASE_URL: string; SESSIONS: KVNamespace } },
  loginName: string,
): Promise<string> {
  const cacheKey = `yodlee:token:${loginName}`
  const cached = await c.env.SESSIONS.get(cacheKey)
  if (cached) return cached

  const res = await fetch(`${c.env.YODLEE_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: {
      'loginName': loginName,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Api-Version': '1.1',
    },
    body: `clientId=${encodeURIComponent(c.env.YODLEE_CLIENT_ID)}&secret=${encodeURIComponent(c.env.YODLEE_SECRET)}`,
  })
  if (!res.ok) throw new Error(`Yodlee auth error ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { token?: { accessToken?: string } }
  const token = data?.token?.accessToken
  if (!token) throw new Error('No accessToken in Yodlee auth response')
  // Token lives 30 min; cache for 25.
  await c.env.SESSIONS.put(cacheKey, token, { expirationTtl: 1500 })
  return token
}

async function yodleeFetch(
  c: { env: { YODLEE_CLIENT_ID: string; YODLEE_SECRET: string; YODLEE_BASE_URL: string; YODLEE_TEST_LOGIN: string; SESSIONS: KVNamespace } },
  path: string,
): Promise<Record<string, unknown>> {
  const token = await yodleeToken(c, c.env.YODLEE_TEST_LOGIN)
  const res = await fetch(`${c.env.YODLEE_BASE_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Api-Version': '1.1',
      'Content-Type': 'application/json',
    },
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(`Yodlee API error ${res.status}: ${JSON.stringify(json)}`)
  return json
}

type YodleeAccount = {
  id?: number
  accountNumber?: string
  accountName?: string
  accountType?: string
  providerAccountId?: number
  providerName?: string
  balance?: { amount?: number; currency?: string }
}

type YodleeTx = {
  id?: number
  baseType?: string
  transactionDate?: string
  description?: string
  amount?: { amount?: number }
  merchant?: { name?: string }
}

function parseYodleeFetch(data: { account?: unknown[]; transaction?: unknown[] }): { accounts: { maskedAccNumber: string; bankName: string; balance: number; fipId: string }[]; transactions: { txnId: string; txnType: string; amount: number; narration: string; timestamp: string }[] } {
  const accounts: { maskedAccNumber: string; bankName: string; balance: number; fipId: string }[] = []
  const transactions: { txnId: string; txnType: string; amount: number; narration: string; timestamp: string }[] = []

  for (const raw of data.account ?? []) {
    const a = raw as YodleeAccount
    accounts.push({
      maskedAccNumber: a.accountNumber ?? a.accountName ?? '',
      bankName: a.providerName ?? '',
      balance: Number(a.balance?.amount) || 0,
      fipId: String(a.providerAccountId ?? a.id ?? ''),
    })
  }

  for (const raw of data.transaction ?? []) {
    const t = raw as YodleeTx
    transactions.push({
      txnId: String(t.id ?? ''),
      txnType: t.baseType === 'DEBIT' ? 'debit' : 'credit',
      amount: Number(t.amount?.amount) || 0,
      narration: t.description ?? t.merchant?.name ?? '',
      timestamp: t.transactionDate ?? '',
    })
  }

  return { accounts, transactions }
}

async function syncYodleeData(c: { env: Env }, userId: string) {
  const from = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10)
  const to = new Date().toISOString().slice(0, 10)
  const [accountsRes, txnsRes] = await Promise.all([
    yodleeFetch(c, '/accounts'),
    yodleeFetch(c, `/transactions?fromDate=${from}&toDate=${to}&top=500`),
  ])
  const { accounts, transactions } = parseYodleeFetch({ account: accountsRes.account as unknown[] | undefined, transaction: txnsRes.transaction as unknown[] | undefined })

  const syncRes = (await backendGql(
    c,
    `mutation SyncAa($aaHandle: String!, $consentId: String!, $accounts: [AaAccountInput!]!, $transactions: [AaTxInput!]!) {
      syncAaData(aaHandle: $aaHandle, consentId: $consentId, accounts: $accounts, transactions: $transactions) {
        inserted balance accountId
      }
    }`,
    userId,
    { aaHandle: 'yodlee', consentId: 'yodlee', accounts, transactions },
  )) as { syncAaData?: { inserted: number; balance: number | null; accountId: string | null } }

  return { accounts, transactions, syncRes }
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

app.post('/auth/revoke-all', async (c) => {
  const secret = c.req.header('x-cartis-backend-secret')
  if (!secret || secret !== c.env.BACKEND_SECRET) return c.json({ error: 'unauthorized' }, 401)
  const { userId } = (await c.req.json().catch(() => ({}))) as { userId?: string }
  if (!userId) return c.json({ error: 'userId required' }, 400)
  const tokens = await userSessions(c, userId)
  let revoked = 0
  for (const token of tokens) {
    await c.env.SESSIONS.delete(`session:${token}`)
    revoked++
  }
  await c.env.SESSIONS.delete(`user_sessions:${userId}`)
  return c.json({ ok: true, revoked })
})

app.post('/api/email', async (c) => {
  const secret = c.req.header('x-cartis-backend-secret')
  if (!secret || secret !== c.env.BACKEND_SECRET) return c.json({ error: 'unauthorized' }, 401)
  if (!c.env.RESEND_API_KEY) return c.json({ error: 'no RESEND_API_KEY' }, 503)
  const { to, subject, html } = (await c.req.json().catch(() => ({}))) as { to?: string; subject?: string; html?: string }
  if (!to || !subject || !html) return c.json({ error: 'to, subject, html required' }, 400)
  const from = c.env.EMAIL_FROM ?? 'Cartis <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  const ok = res.ok
  if (!ok) {
    const body = await res.text().catch(() => '')
    c.env.SESSIONS.put(`email:fail:${Date.now()}`, body.slice(0, 500), { expirationTtl: 86400 })
    return c.json({ error: `resend ${res.status}`, detail: body.slice(0, 300) }, 502)
  }
  return c.json({ ok: true })
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
    tool?: string
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
      body: JSON.stringify({
        session_id: body.session_id,
        mode: body.mode,
        tool: body.tool,
        message: body.message,
      }),
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

app.delete('/api/coach/sessions/:id', auth, async (c) => {
  try {
    const res = await fetch(`${c.env.BACKEND_URL}/chat/sessions/${c.req.param('id')}`, {
      method: 'DELETE',
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

app.patch('/api/coach/sessions/:id', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string }
  if (!body.title?.trim()) return c.json({ error: 'title required' }, 400)
  try {
    const res = await fetch(`${c.env.BACKEND_URL}/chat/sessions/${c.req.param('id')}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-cartis-backend-secret': c.env.BACKEND_SECRET,
        'x-user-id': c.get('session').user_id,
      },
      body: JSON.stringify({ title: body.title }),
    })
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
  const ent = (event.data ?? {}) as {
    metadata?: { user_id?: string }
    status?: string
    paidAt?: string | null
    type?: string
  }
  const userId = ent.metadata?.user_id
  const paid = ['order.paid', 'checkout.updated', 'order.updated'].includes(event.type ?? '') && userId
  if (paid && (ent.status === 'paid' || ent.paidAt || event.type === 'order.paid')) {
    await c.env.SESSIONS.put(`polar:entitled:${userId}`, JSON.stringify({ plan: 'pro', since: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 365 })
    console.log('[polar] entitlement granted', userId)
  }
  return c.json({ ok: true })
})

// ── Account linking (Yodlee FastLink) routes ───────────────────────────────

// FastLink launch page: mints a user token server-side and opens the hosted
// link UI. Callback URL (UI page with ?linked=1) is passed as cb.
app.get('/aa/link', async (c) => {
  const cb = c.req.query('cb') ?? ''
  try {
    const token = await yodleeToken(c, c.env.YODLEE_TEST_LOGIN)
    const fl = c.env.YODLEE_FASTLINK_URL
    const jsUrl = new URL('/fastlink/js/fastlink.js', fl).toString()
    const paramsJson = JSON.stringify(cb ? { callbackURL: cb } : {})
    return c.html(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link your bank</title><script src="${jsUrl}"></script>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155}div{text-align:center}p{opacity:.7;font-size:14px}</style>
</head><body><div><p>Opening secure bank link…</p></div>
<script>
  var params = ${paramsJson};
  try {
    fastlink.open({ fastLinkURL: ${JSON.stringify(fl)}, jwtToken: ${JSON.stringify(token)}, params: params });
    fastlink.on('success', function (data) {
      if (data && data.providerAccount) {
        fetch('/aa/success', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerAccountId: data.providerAccount.providerAccountId, sessionId: data.sessionId || null }) }).catch(function () {});
      }
    });
    fastlink.on('close', function () { if (params.callbackURL) { window.location.href = params.callbackURL; } });
  } catch (e) { document.body.innerHTML = '<p>FastLink failed to start: ' + e.message + '</p>'; }
</script></body></html>`)
  } catch (e) {
    return c.html(`<p>Failed to start bank link: ${String(e)}</p>`, 502)
  }
})

// FastLink onSuccess hook (same-origin from /aa/link page; sandbox shared login).
app.post('/aa/success', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { providerAccountId?: number | string; sessionId?: string | null }
  const providerAccountId = body.providerAccountId ?? null
  if (providerAccountId !== null) {
    await c.env.SESSIONS.put('yodlee:linked', JSON.stringify({ providerAccountId: String(providerAccountId), sessionId: body.sessionId ?? null, timestamp: new Date().toISOString() }), { expirationTtl: 86400 })
  }
  console.log('[yodlee] linked', providerAccountId)
  return c.json({ ok: true })
})

app.post('/api/aa/consent', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { redirectUrl?: string }
  const cb = typeof body.redirectUrl === 'string' && body.redirectUrl ? body.redirectUrl : ''
  const linkUrl = `${new URL('/aa/link', c.req.url).toString()}?cb=${encodeURIComponent(cb)}`
  return c.json({ linkUrl })
})

app.get('/api/aa/status/:consentId', auth, async (c) => {
  const linked = await c.env.SESSIONS.get('yodlee:linked')
  if (!linked) return c.json({ consentStatus: 'PENDING', consentId: c.req.param('consentId') })
  try {
    const data = await yodleeFetch(c, '/accounts')
    const raw = (data.account ?? []) as YodleeAccount[]
    const accounts = raw.map((a) => ({
      maskedAccNumber: a.accountNumber ?? a.accountName ?? '',
      fipId: String(a.providerAccountId ?? a.id ?? ''),
      accType: a.accountType ?? '',
      linkRefNumber: String(a.id ?? ''),
    }))
    return c.json({ consentStatus: 'ACTIVE', consentId: c.req.param('consentId'), accounts })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/aa/fetch', auth, async (c) => {
  const userId = c.get('session').user_id
  try {
    const { accounts, transactions, syncRes } = await syncYodleeData(c, userId)
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
    const { accounts, transactions, syncRes } = await syncYodleeData(c, userId)
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

// ── Tools ────────────────────────────────────────────────────────────────────

app.post('/api/tools/retirement', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    current_age?: number
    retire_age?: number
    monthly_expense?: number
    current_corpus?: number
    monthly_sip?: number
  }
  const a = Number(body.current_age) || 30
  const r = Number(body.retire_age) || 60
  const exp = Number(body.monthly_expense) || 50000
  const corpus = Number(body.current_corpus) || 0
  const sip = Number(body.monthly_sip) || 0
  if (a >= r) return c.json({ error: 'retire_age must be > current_age' }, 400)
  const years = r - a
  const growth = Math.pow(1.12, years)
  const sipGrowth = sip * 12 * ((growth - 1) / 0.12)
  const future = corpus * growth + sipGrowth
  const swr = future * 0.04
  const infl = Math.pow(1.06, years)
  const today = swr / infl
  const shortfall = Math.max(0, exp - today)
  const requiredSip = (exp * infl - corpus * growth * 0.04) / (12 * ((growth - 1) / 0.12) * 0.04)
  return c.json({
    years,
    growth_assumption_pct: 12,
    inflation_pct: 6,
    projected_corpus: Math.round(future),
    monthly_retirement_income: Math.round(swr),
    monthly_retirement_income_today: Math.round(today),
    monthly_expense_today: exp,
    monthly_shortfall: Math.round(shortfall),
    required_monthly_sip_for_full_cover: Math.max(0, Math.round(requiredSip)),
  })
})

app.post('/api/tools/tax', auth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    annual_income?: number
    hra?: number
    rent_paid?: number
    metro?: boolean
    basic_da?: number
    s80c?: number
    s80d?: number
    other_exemptions?: number
  }
  const income = Number(body.annual_income) || 0
  const newRegimeTax = (n: number) => {
    if (n <= 300000) return 0
    const slabs: [number, number][] = [[700000, 0.05], [1000000, 0.1], [1200000, 0.15], [1500000, 0.2], [Infinity, 0.3]]
    let tax = 0
    let prev = 300000
    for (const [cap, rate] of slabs) {
      const slice = Math.min(n, cap) - prev
      if (slice > 0) tax += slice * rate
      prev = cap
    }
    return tax
  }
  const oldRegimeTax = (n: number) => {
    if (n <= 250000) return 0
    const slabs: [number, number][] = [[500000, 0.05], [1000000, 0.2], [Infinity, 0.3]]
    let tax = 0
    let prev = 250000
    for (const [cap, rate] of slabs) {
      const slice = Math.min(n, cap) - prev
      if (slice > 0) tax += slice * rate
      prev = cap
    }
    return tax
  }
  const s80c = Math.min(Number(body.s80c) || 0, 150000)
  const s80d = Math.min(Number(body.s80d) || 0, 25000)
  const other = Number(body.other_exemptions) || 0
  const hraClaimed = Math.min(
    Number(body.hra) || 0,
    Math.min((Number(body.basic_da) || 0) * 0.5, Math.max(0, (Number(body.rent_paid) || 0) - ((Number(body.basic_da) || 0) * 0.1))),
  )
  const newTaxRaw = newRegimeTax(income)
  const newTax = income <= 1200000 ? 0 : newTaxRaw // 87A rebate (₹60k) zeroes tax up to ₹12L; marginal relief ignored
  const oldTaxable = Math.max(0, income - 50000 - s80c - s80d - hraClaimed - other)
  const oldTax = Math.max(0, oldRegimeTax(oldTaxable))
  const better = newTax <= oldTax ? 'new' : 'old'
  return c.json({
    fy: '2026-27',
    new_regime_tax: Math.round(newTax),
    old_regime_tax: Math.round(oldTax),
    better_regime: better,
    saving_if_switch: Math.round(Math.abs(newTax - oldTax)),
    hra_exemption_used: Math.round(hraClaimed),
    s80c_headroom: Math.max(0, 150000 - s80c),
  })
})

app.get('/api/tools/stock', auth, async (c) => {
  const symbol = (c.req.query('symbol') || '').trim()
  if (!symbol) return c.json({ error: 'symbol required, e.g. RELIANCE.NSE' }, 400)
  try {
    // EC2 Python yfinance service via the generic setu-proxy passthrough (Redis-cached there).
    const res = await setuProxy(c, `http://127.0.0.1:8001/quote?symbol=${encodeURIComponent(symbol)}`, 'GET', {})
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (data && typeof data.error === 'string') return c.json({ error: data.error }, res.status === 404 ? 404 : 502)
    if (!res.ok || !data) return c.json({ error: `stock service error ${res.status}` }, 502)
    return c.json(data)
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

// ── Advisor: KPIs, benchmarks, health score ─────────────────────────────────

type AdvisorFin = { entryType: string; amount: number; category: string | null; transactionDate: string }

const ADVISOR_BENCHMARKS: Record<string, { gm: [number, number]; nm: [number, number]; label: string }> = {
  saas: { gm: [70, 85], nm: [15, 25], label: 'SaaS' },
  d2c: { gm: [40, 60], nm: [5, 15], label: 'D2C brand' },
  services: { gm: [50, 70], nm: [10, 20], label: 'Services' },
  retail: { gm: [20, 40], nm: [2, 8], label: 'Retail' },
}

function marginScore(v: number, low: number): number {
  if (low <= 0) return 100
  return Math.max(0, Math.min(100, (v / low) * 100))
}
function cashScore(cash: number, revenue: number): number {
  if (revenue <= 0) return cash >= 0 ? 100 : 0
  return Math.max(0, Math.min(100, 50 + (cash / revenue) * 200))
}
function momentumScore(cur: number, last: number): number {
  if (last <= 0) return 100
  return Math.max(0, Math.min(100, 50 + ((cur - last) / last) * 100))
}
function costScore(opexRev: number): number {
  return Math.max(0, Math.min(100, 100 - Math.max(0, opexRev - 0.4) * 150))
}

function advisorHealth(fins: AdvisorFin[], businessType: string) {
  const now = new Date()
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const last = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  const lastYm = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}`
  let revenue = 0, cogs = 0, opex = 0, lastRevenue = 0
  const opexCats = new Map<string, number>()
  for (const f of fins) {
    if (f.transactionDate.startsWith(lastYm) && f.entryType === 'revenue') lastRevenue += f.amount
    if (!f.transactionDate.startsWith(ym)) continue
    if (f.entryType === 'revenue') revenue += f.amount
    else if (f.entryType === 'cogs') cogs += f.amount
    else {
      opex += f.amount
      const k = f.category || 'Other'
      opexCats.set(k, (opexCats.get(k) ?? 0) + f.amount)
    }
  }
  const expenses = cogs + opex
  const cash = revenue - expenses
  const gm = revenue > 0 ? (revenue - cogs) / revenue : 0
  const nm = revenue > 0 ? (revenue - expenses) / revenue : 0
  const bench = ADVISOR_BENCHMARKS[businessType] ?? ADVISOR_BENCHMARKS.saas
  const score = Math.round(
    0.3 * marginScore(gm, bench.gm[0] / 100) +
      0.3 * marginScore(nm, bench.nm[0] / 100) +
      0.2 * cashScore(cash, revenue) +
      0.1 * momentumScore(revenue, lastRevenue) +
      0.1 * costScore(revenue > 0 ? opex / revenue : 0),
  )
  const leaks: { type: string; label: string; detail: string }[] = []
  if (revenue <= 0) {
    leaks.push({
      type: 'no_data',
      label: 'No revenue recorded',
      detail: `Enter income and expenses for ${ym} to get a health score.`,
    })
  } else if (gm < bench.gm[0] / 100) {
    leaks.push({
      type: 'gross_margin',
      label: 'COGS cost pressure',
      detail: `Direct costs are ${revenue > 0 ? Math.round((cogs / revenue) * 100) : 0}% of revenue; healthy ${bench.label} businesses keep them under ${100 - bench.gm[0]}%.`,
    })
  } else if (nm < bench.nm[0] / 100) {
    for (const [cat, amt] of [...opexCats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)) {
      leaks.push({
        type: 'margin_leak',
        label: cat,
        detail: `${cat} cost ₹${Math.round(amt).toLocaleString('en-IN')} this month${revenue > 0 ? ` (${Math.round((amt / revenue) * 100)}% of revenue)` : ''} — investigate before scaling.`,
      })
    }
  }
  return {
    period: ym,
    businessType: bench.label,
    kpis: {
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      cogs: Math.round(cogs),
      opex: Math.round(opex),
      cash: Math.round(cash),
      grossMarginPct: Math.round(gm * 1000) / 10,
      netMarginPct: Math.round(nm * 1000) / 10,
    },
    benchmarks: { grossMargin: bench.gm, netMargin: bench.nm },
    score,
    leaks,
  }
}

function execSummary(health: ReturnType<typeof advisorHealth>): string {
  const k = health.kpis
  if (health.leaks.some((l) => l.type === 'no_data')) {
    return 'No revenue is recorded for this period yet — enter your income and expenses to get a financial health assessment.'
  }
  if (health.score >= 70) {
    return `Your ${health.businessType} financials are healthy: ${k.grossMarginPct}% gross margin and ${k.netMarginPct}% net margin are at or above benchmark, and cash flow is ${k.cash >= 0 ? 'positive' : 'tight'}. You are positioned to invest in growth.`
  }
  if (health.score >= 40) {
    return `Your financials score ${health.score}/100 for ${health.businessType}: margins are workable, but ${health.leaks[0]?.label ?? 'costs'} are eroding profitability — fix the leaks before scaling spend.`
  }
  return `Your financials score ${health.score}/100 — thin margins and ${k.cash < 0 ? 'negative' : 'tight'} cash flow mean the priority is cost control and customer retention, not growth.`
}

async function savedBusinessType(c: { env: { BACKEND_URL: string; BACKEND_SECRET: string } }, userId: string): Promise<string> {
  try {
    const data = (await backendGql(c, 'query { me { businessType } }', userId)) as { me?: { businessType?: string } | null }
    const t = data?.me?.businessType
    return t && Object.hasOwn(ADVISOR_BENCHMARKS, t) ? t : 'saas'
  } catch {
    return 'saas'
  }
}

function advisorFallback(health: ReturnType<typeof advisorHealth>) {
  const k = health.kpis
  return {
    period: health.period,
    healthScore: health.score,
    executiveSummary: execSummary(health),
    revenueTactics: [
      { title: 'Fix the top cost line', detail: `${health.leaks[0]?.label ?? 'Expenses'}: ${health.leaks[0]?.detail ?? 'renegotiate the largest vendor'} — every ₹1 saved is ₹1 of profit.` },
      { title: k.revenue > 0 ? 'Sell more to existing customers' : 'Record your first revenue', detail: k.revenue > 0 ? 'Upsell and annual plans before chasing new acquisition — retention is cheaper and faster.' : 'Enter income into the Income page so the advisor can score your business.' },
      { title: 'Lean on GST input credit', detail: 'Reconcile purchase invoices and claim input tax credit on every eligible expense — unclaimed ITC is cash left on the table.' },
    ],
    capitalAllocation: {
      recommendation: health.score >= 70 ? 'invest-in-growth' : health.score >= 40 ? 'efficiency' : 'cut-costs',
      detail:
        health.score >= 70
          ? 'Healthy margins and positive cash flow — allocate to product and sales before expanding into new markets.'
          : health.score >= 40
            ? 'Mixed fundamentals — fix margin leaks and retention before scaling acquisition spend.'
            : 'Thin margins and tight cash — prioritize cost reduction and customer retention over growth.',
    },
    risks: [
      { risk: 'Customer concentration', severity: 'medium' as const, mitigation: 'Track top-3 customer share of revenue; diversify within the next two quarters.' },
      { risk: 'Cash-flow timing', severity: 'medium' as const, mitigation: 'Invoice promptly, offer advance-payment discounts, keep a 3-month runway buffer.' },
      { risk: 'Margin erosion', severity: k.grossMarginPct < 40 ? ('high' as const) : ('low' as const), mitigation: 'Review supplier pricing quarterly; renegotiate when volume grows.' },
      { risk: 'Compliance surprises', severity: 'medium' as const, mitigation: 'Keep GST returns reconciled monthly — penalties compound faster than growth.' },
    ],
    fallback: true,
  }
}

app.post('/api/advisor/health', auth, async (c) => {
  const userId = c.get('session').user_id
  const refresh = c.req.query('refresh') === '1'
  const body = (await c.req.json().catch(() => ({}))) as { businessType?: string }
  const businessType = Object.hasOwn(ADVISOR_BENCHMARKS, body.businessType ?? '') ? (body.businessType as string) : await savedBusinessType(c, userId)
  const cacheKey = `advisor:health:${userId}:${businessType}`
  if (!refresh) {
    const cached = await c.env.SESSIONS.get(cacheKey)
    if (cached) return c.json(JSON.parse(cached))
  }
  try {
    const data = (await backendGql(
      c,
      `query { sellerFinances(limit: 5000) { entryType amount category transactionDate } }`,
      userId,
    )) as { sellerFinances?: AdvisorFin[] }
    const result = advisorHealth(data.sellerFinances ?? [], businessType)
    await c.env.SESSIONS.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
    return c.json(result)
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/advisor/strategies', auth, async (c) => {
  const userId = c.get('session').user_id
  const refresh = c.req.query('refresh') === '1'
  const body = (await c.req.json().catch(() => ({}))) as { businessType?: string }
  const businessType = Object.hasOwn(ADVISOR_BENCHMARKS, body.businessType ?? '') ? (body.businessType as string) : await savedBusinessType(c, userId)
  const cacheKey = `advisor:strategies:${userId}:${businessType}`
  if (!refresh) {
    const cached = await c.env.SESSIONS.get(cacheKey)
    if (cached) return c.json(JSON.parse(cached))
  }
  try {
    const data = (await backendGql(
      c,
      `query { sellerFinances(limit: 5000) { entryType amount category transactionDate } }`,
      userId,
    )) as { sellerFinances?: AdvisorFin[] }
    const health = advisorHealth(data.sellerFinances ?? [], businessType)
    const prompt = `You are a financial advisor for an Indian startup. Based ONLY on these KPIs and benchmarks, produce a strategy.

KPIs (${health.period}): ${JSON.stringify(health.kpis)}
Industry benchmarks (${health.businessType}): gross margin ${health.benchmarks.grossMargin[0]}-${health.benchmarks.grossMargin[1]}%, net margin ${health.benchmarks.netMargin[0]}-${health.benchmarks.netMargin[1]}%
Financial health score: ${health.score}/100
Flags: ${JSON.stringify(health.leaks)}

Return ONLY JSON:
{
  "executiveSummary": "2-4 sentences interpreting this financial health for an investor, banker or co-founder: what the numbers mean, the single biggest lever, and the outlook",
  "revenueTactics": [3 specific, actionable tactics, each: { "title": "...", "detail": "..." }],
  "capitalAllocation": { "recommendation": "invest-in-growth | cut-costs | efficiency", "detail": "1-2 sentences, concrete" },
  "risks": [4-5 risks ranked by severity, each: { "risk": "...", "severity": "high|medium|low", "mitigation": "..." }]
}
Rules: be specific and actionable for an Indian SMB; mention concrete levers (GST input credit, vendor renegotiation, pricing tiers, retention); never invent numbers beyond the KPIs given; keep each field under 40 words.`
    const out = (await c.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'user', content: prompt }],
    })) as { response?: string; choices?: Array<{ message?: { content?: string } }> }
    const content = (typeof out.response === 'string' ? out.response : (out.choices?.[0]?.message?.content ?? '')).replace(/```json|```/g, '')
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    let parsed: {
      executiveSummary?: string
      revenueTactics?: { title?: string; detail?: string }[]
      capitalAllocation?: { recommendation?: string; detail?: string }
      risks?: { risk?: string; severity?: string; mitigation?: string }[]
    } | null = null
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        parsed = null
      }
    }
    if (!parsed) return c.json(advisorFallback(health))
    const result = {
      period: health.period,
      healthScore: health.score,
      executiveSummary: (parsed.executiveSummary ?? '').trim() || execSummary(health),
      revenueTactics: (parsed.revenueTactics ?? []).slice(0, 3).map((t) => ({ title: t.title ?? 'Tactic', detail: t.detail ?? '' })),
      capitalAllocation: {
        recommendation: ['invest-in-growth', 'cut-costs', 'efficiency'].includes(parsed.capitalAllocation?.recommendation ?? '')
          ? (parsed.capitalAllocation?.recommendation as 'invest-in-growth' | 'cut-costs' | 'efficiency')
          : 'efficiency',
        detail: parsed.capitalAllocation?.detail ?? '',
      },
      risks: (parsed.risks ?? []).slice(0, 5).map((r) => ({
        risk: r.risk ?? '',
        severity: ['high', 'medium', 'low'].includes(r.severity ?? '') ? (r.severity as 'high' | 'medium' | 'low') : 'medium',
        mitigation: r.mitigation ?? '',
      })),
    }
    if (!result.revenueTactics.length || !result.risks.length) {
      return c.json(advisorFallback(health))
    }
    await c.env.SESSIONS.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
    return c.json(result)
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.get('/api/advisor/entitlement', auth, async (c) => {
  const userId = c.get('session').user_id
  const ent = await c.env.SESSIONS.get(`polar:entitled:${userId}`)
  return c.json({ pro: ent !== null, since: ent ? (JSON.parse(ent) as { since?: string }).since ?? null : null })
})

// ── Catch-all asset handler ─────────────────────────────────────────────────

app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (!res.headers.get('content-type')?.includes('text/html')) return res
  return new Response(res.body, { status: res.status, headers: { ...res.headers, 'Cache-Control': 'no-store' } })
})

export default app
