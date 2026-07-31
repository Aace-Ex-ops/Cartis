import { Hono } from 'hono'

type Env = {
  SESSIONS: KVNamespace
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  WORKER_AUTH_SECRET: string
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const SESSION_TTL = 604800
const STATE_TTL = 600

const app = new Hono<{ Bindings: Env }>()

async function sha256Hex(input: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
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
  if (!infoRes.ok || !info.email) return c.json({ error: 'userinfo failed', details: info }, 401)

  const sessionId = randomHex()
  const expiration = Math.floor(Date.now() / 1000) + SESSION_TTL
  const sessionToken = await sha256Hex(sessionId + expiration + c.env.WORKER_AUTH_SECRET)
  const session = {
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

  c.header('Set-Cookie', `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`)
  return c.redirect('/auth/me')
})

app.get('/auth/me', async (c) => {
  const token = c.req.header('cookie')?.match(/session=([^;]+)/)?.[1]
  if (!token) return c.json({ error: 'unauthenticated' }, 401)
  const raw = await c.env.SESSIONS.get(`session:${token}`)
  if (!raw) return c.json({ error: 'unauthenticated' }, 401)
  const session = JSON.parse(raw)
  if (session.exp < Math.floor(Date.now() / 1000)) {
    await c.env.SESSIONS.delete(`session:${token}`)
    return c.json({ error: 'session expired' }, 401)
  }
  return c.json({ user: { id: session.user_id, email: session.email, name: session.name, avatar: session.avatar } })
})

app.get('/auth/logout', async (c) => {
  const token = c.req.header('cookie')?.match(/session=([^;]+)/)?.[1]
  if (token) await c.env.SESSIONS.delete(`session:${token}`)
  c.header('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
  return c.json({ ok: true })
})

export default app
