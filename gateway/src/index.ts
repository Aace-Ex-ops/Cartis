import { Hono, type Context, type MiddlewareHandler } from 'hono'
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
): Promise<unknown> {
  const res = await fetch(`${c.env.BACKEND_URL}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cartis-backend-secret': c.env.BACKEND_SECRET,
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify({ query }),
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

async function sellerContext(c: Context): Promise<string> {
  const data = (await backendGql(
    c,
    `query { sellerDashboard { revenue expenses profitMargin cashOnHand lastMonthRevenue lastMonthExpenses }
      sellerFinances(limit: 20) { entryType amount category description transactionDate }
      sellerCategories(entryType: "expense") { name spent }
      sellerInventory { name stock reorderLevel unitCost } }`,
    c.get('session').user_id,
  )) as SellerGql
  const lines: string[] = []
  const d = data.sellerDashboard
  if (d) {
    lines.push(
      `Business (current month): revenue ₹${d.revenue}, expenses ₹${d.expenses}, profit margin ${d.profitMargin.toFixed(1)}%, cash on hand ₹${d.cashOnHand}.`,
    )
    if (d.lastMonthRevenue > 0) {
      const g = ((d.revenue - d.lastMonthRevenue) / d.lastMonthRevenue) * 100
      lines.push(`Revenue vs last month: ${g >= 0 ? '+' : ''}${g.toFixed(1)}%`)
    }
  }
  if (data.sellerCategories?.length) {
    lines.push(`Top expense categories: ${data.sellerCategories.map((c) => `${c.name} ₹${c.spent}`).join(', ')}`)
  }
  if (data.sellerFinances?.length) {
    const last = data.sellerFinances.slice(0, 5)
    lines.push(`Recent entries: ${last.map((e) => `${e.entryType} ₹${e.amount} ${e.description ?? e.category ?? ''} (${e.transactionDate})`).join(' | ')}`)
  }
  const low = (data.sellerInventory ?? []).filter((i) => i.stock <= i.reorderLevel)
  if (low.length) lines.push(`Low stock: ${low.map((i) => `${i.name} (${i.stock} left, reorder at ${i.reorderLevel})`).join(', ')}`)
  return lines.length ? lines.join('\n') : 'No business data recorded yet.'
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

async function consumerContext(c: Context): Promise<string> {
  const data = (await backendGql(
    c,
    `query { wallet { balance tabLimit } monthlyTab { limit spent } spending30d { day spend }
      bankAccounts { bankName balance } me { monthlyIncome monthlySpend investmentPct housingCost dependents debtEmis monthlyTax } }`,
    c.get('session').user_id,
  )) as ConsumerGql
  const lines: string[] = []
  const w = data.wallet
  if (w) lines.push(`Wallet: balance ₹${w.balance}, monthly tab limit ₹${w.tabLimit}.`)
  const t = data.monthlyTab
  if (t) lines.push(`Spent this month: ₹${t.spent} of ₹${t.limit} (${t.limit ? Math.round((t.spent / t.limit) * 100) : 0}%).`)
  if (data.spending30d?.length) {
    const total = data.spending30d.reduce((s, d) => s + d.spend, 0)
    lines.push(`Spent last 30 days: ₹${total}.`)
  }
  if (data.bankAccounts?.length) {
    lines.push(`Accounts: ${data.bankAccounts.map((a) => `${a.bankName} ₹${a.balance ?? 0}`).join(', ')}`)
  }
  const p = data.me
  if (p?.monthlyIncome) {
    const tax = p.monthlyTax ?? 0
    const invest = p.investmentPct ? Math.round((p.monthlyIncome * p.investmentPct) / 100) : 0
    lines.push(
      `Profile: income ₹${p.monthlyIncome}/mo, TDS ₹${tax}/mo, spend ₹${p.monthlySpend ?? '?'}/mo, invests ${p.investmentPct ?? 0}% (₹${invest}/mo), housing ₹${p.housingCost ?? 0}/mo, dependents ${p.dependents ?? 0}, EMIs ₹${p.debtEmis ?? 0}/mo.`,
    )
  }
  return lines.length ? lines.join('\n') : 'No financial data recorded yet. Complete onboarding for personalized help.'
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
  let source: 'regex' | 'ai' | 'none' = 'regex'
  let balance: number | undefined = transactions[transactions.length - 1]?.balance
  const bankName =
    text.match(/^\s*([A-Za-z][A-Za-z .&'-]*(?:Bank|SBI|Union))\s*(?::|[-–]|\()/i)?.[1] ?? null

  if (transactions.length === 0) {
    const balOnly = text.match(/bal(?:ance)?[:\s]+(?:is\s+)?rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i)
    if (balOnly) {
      balance = num(balOnly[1])
    } else if (/rs\.?|₹|inr/i.test(text)) {
      try {
        const prompt = `Extract bank SMS transactions into a JSON array. Each item: {"type":"debit"|"credit","amount":<number>,"account_last4":<string|null>,"balance":<number|null>,"date":<string|null>,"payee":<string|null>}. Only include entries explicitly described as debited/credited/sent/received. If the message states a balance but no transaction, return an empty array. Output ONLY the JSON array, no markdown.\n\nSMS:\n${text}`
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
            balance = transactions[transactions.length - 1]?.balance ?? balance
          } catch {
            transactions = []
          }
        }
      } catch (e) {
        return c.json({ transactions: [], source: 'none', count: 0, error: String(e) }, 502)
      }
    } else {
      source = 'none'
    }
  }

  if (transactions.length === 0 && balance === undefined) return c.json({ transactions: [], source, count: 0, note: 'nothing recognized — check the message format', version: 'payee-v2' })
  return c.json({ transactions, balance: balance ?? null, bank_name: bankName, source, count: transactions.length, version: 'payee-v2' })
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
    messages?: { role: 'user' | 'assistant'; content: string }[]
    mode?: 'consumer' | 'seller'
  }
  const messages = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-10)
  if (!messages.length) return c.json({ error: 'messages required' }, 400)
  const seller = body.mode === 'seller'

  let context = seller ? 'No business data recorded yet.' : 'No financial data available yet.'
  try {
    if (seller) {
      context = await sellerContext(c)
    } else {
      const data = (await backendGql(
        c,
        `query { wallet { balance tabLimit } monthlyTab { limit spent } bankAccounts { bankName balance } spending30d { day spend } me { aiModel } }`,
        c.get('session').user_id,
      )) as {
        wallet?: { balance: number; tabLimit: number }
        monthlyTab?: { limit: number; spent: number }
        bankAccounts?: { bankName: string; balance: number | null }[]
        spending30d?: { day: string; spend: number }[]
        me?: { aiModel: string | null }
      }
      const aiModel = data.me?.aiModel ?? undefined
      const lines: string[] = []
      if (data?.bankAccounts?.length) {
        lines.push(
          `Bank accounts: ${data.bankAccounts
            .map((a) => `${a.bankName} balance ${a.balance ?? 'unknown'}`)
            .join('; ')}`,
        )
      }
      if (data?.wallet) lines.push(`Cartis wallet balance: ${data.wallet.balance}`)
      if (data?.monthlyTab) {
        lines.push(`Monthly tab: limit ${data.monthlyTab.limit}, spent ${data.monthlyTab.spent}`)
      }
      if (data?.spending30d?.length) {
        const total = data.spending30d.reduce((s, d) => s + d.spend, 0)
        lines.push(`Spend last 30 days: ${total} across ${data.spending30d.length} days`)
      }
      if (lines.length) context = lines.join('\n')
      if (aiModel) c.set('aiModel', aiModel)
    }
  } catch {
    // context stays — chat still works without data
  }

  const system = seller
    ? `You are the Cartis AI business twin — a friendly, blunt small-business finance coach for India (₹).
Here is the user's live business data:
${context}
Give concise, actionable advice (2-4 sentences). Use ₹ amounts. Focus on revenue, expenses, margins, inventory and GST. If data is missing, say so and suggest how to add it. Never invent numbers.`
    : `You are the Cartis AI financial twin — a friendly, blunt personal finance coach for India (₹).
Here is the user's live financial data:
${context}
Give concise, actionable advice (2-4 sentences). Use ₹ amounts. If data is missing, say so and suggest how to add it. Never invent numbers.`

  try {
    const out = (await c.env.AI.run(c.get('aiModel') || '@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'system', content: system }, ...messages],
    })) as { response?: string; choices?: Array<{ message?: { content?: string } }> }
    const reply =
      typeof out.response === 'string' ? out.response : (out.choices?.[0]?.message?.content ?? '')
    if (!reply.trim()) return c.json({ error: 'empty model reply' }, 502)
    return c.json({ reply: reply.trim() })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/seller/coach', auth, async (c) => {
  try {
    const context = await sellerContext(c)
    const prompt = `You are the Cartis business coach for a small Indian business. Based ONLY on this live data:
${context}
Generate exactly 3 insights. Return ONLY JSON:
{"insights":[{"title":"short headline","detail":"2-3 plain-English sentences with ₹ amounts","tone":"warn"|"good"|"info"}]}
warn = problem to fix, good = opportunity to grow, info = neutral update. Never invent numbers.`
    const out = (await c.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'user', content: prompt }],
    })) as { response?: string; choices?: Array<{ message?: { content?: string } }> }
    const content =
      typeof out.response === 'string' ? out.response : (out.choices?.[0]?.message?.content ?? '')
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return c.json({ error: 'no insights' }, 502)
    const parsed = JSON.parse(match[0]) as { insights?: { title: string; detail: string; tone: string }[] }
    const insights = (parsed.insights ?? []).slice(0, 3).map((i) => ({
      title: i.title ?? '',
      detail: i.detail ?? '',
      tone: ['warn', 'good', 'info'].includes(i.tone) ? i.tone : 'info',
    }))
    if (!insights.length) return c.json({ error: 'no insights' }, 502)
    return c.json({ insights })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/api/consumer/coach', auth, async (c) => {
  let content = ''
  try {
    const context = await consumerContext(c)
    const prompt = `You are the Cartis personal finance coach for an Indian salaried user. Based ONLY on this live data:
${context}
Generate exactly 3 insights. Return ONLY JSON:
{"insights":[{"title":"short headline","detail":"2-3 plain-English sentences with ₹ amounts","tone":"warn"|"good"|"info"}]}
warn = problem to fix, good = opportunity to grow, info = neutral update.
One insight MUST cover income tax: estimate yearly income tax under the new regime (slabs: 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, above 24L 30%; standard deduction ₹75,000), compare with TDS already deducted, and flag the ITR deadline of 31 July (or 31 Dec for business) with a filing reminder. Never invent numbers.`
    const out = (await c.env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    })) as { response?: string; choices?: Array<{ message?: { content?: string } }> }
    content =
      typeof out.response === 'string' ? out.response : (out.choices?.[0]?.message?.content ?? '')
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return c.json({ error: 'no insights', raw: content.slice(0, 400) }, 502)
    const parsed = JSON.parse(match[0]) as { insights?: { title: string; detail: string; tone: string }[] }
    const insights = (parsed.insights ?? []).slice(0, 3).map((i) => ({
      title: i.title ?? '',
      detail: i.detail ?? '',
      tone: ['warn', 'good', 'info'].includes(i.tone) ? i.tone : 'info',
    }))
    if (!insights.length) return c.json({ error: 'no insights', raw: content.slice(0, 400) }, 502)
    return c.json({ insights })
  } catch (e) {
    return c.json({ error: String(e), raw: content.slice(0, 400) }, 502)
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

app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (!res.headers.get('content-type')?.includes('text/html')) return res
  return new Response(res.body, { status: res.status, headers: { ...res.headers, 'Cache-Control': 'no-store' } })
})

export default app
