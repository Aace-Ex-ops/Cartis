import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const env = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]
const TOKEN = get('POLAR_ACCESS_TOKEN')
const API = get('POLAR_API_URL')

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json
}

const { items: orgs } = await api('/v1/organizations')
const orgId = orgs[0].id

const products = [
  { name: 'Wallet Credits', description: 'Prepaid credits for coach analyses. 1 credit = 1 analysis.', prices: [{ amount_type: 'fixed', price_amount: 1000, price_currency: 'usd' }] },
  { name: 'Cartis Monthly', description: 'Unlimited coach analyses, $5/month.', recurring_interval: 'month', prices: [{ amount_type: 'fixed', price_amount: 500, price_currency: 'usd' }] },
  { name: 'Cartis Annual', description: 'Unlimited coach analyses, $48/year (save 20%).', recurring_interval: 'year', prices: [{ amount_type: 'fixed', price_amount: 4800, price_currency: 'usd' }] },
  { name: 'One-Time Coaching', description: 'Single in-depth product-purchase coaching session.', prices: [{ amount_type: 'fixed', price_amount: 2500, price_currency: 'usd' }] },
]

const existing = (await api('/v1/products?limit=100')).items ?? []
for (const name of [...new Set(existing.map((p) => p.name))]) {
  const dupes = existing.filter((p) => p.name === name)
  for (const d of dupes.slice(1)) {
    await api(`/v1/products/${d.id}`, 'PATCH', { is_archived: true })
    console.log('archived duplicate:', name, d.id)
  }
}

for (const p of products) {
  if (existing.some((e) => e.name === p.name)) {
    console.log('exists, skipping:', p.name)
    continue
  }
  const created = await api('/v1/products', 'POST', { ...p, organization_id: orgId })
  console.log('created product:', created.name, `(${created.id})`)
}

const endpoints = (await api('/v1/webhooks/endpoints?limit=50')).items ?? []
const existingWh = endpoints.find((e) => e.url.includes('cartis-gateway'))
if (existingWh) {
  console.log('webhook exists:', existingWh.url, `(${existingWh.id})`)
} else {
  const secret = randomBytes(32).toString('hex')
  const wh = await api('/v1/webhooks/endpoints', 'POST', {
    organization_id: orgId,
    url: 'https://cartis-gateway.rz8m4crnwt.workers.dev/webhooks/polar',
    format: 'raw',
    secret,
    events: ['checkout.created', 'order.created', 'subscription.created', 'subscription.updated', 'subscription.canceled', 'product.updated', 'benefit_grant.created'],
  })
  console.log('created webhook:', wh.url, `(${wh.id})`)
  console.log(`POLAR_WEBHOOK_SECRET=${secret}`)
}
