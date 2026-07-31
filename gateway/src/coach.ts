type CoachEnv = { AI: Ai; SESSIONS: KVNamespace; BACKEND_URL: string; BACKEND_SECRET: string }

export type ScrapedProduct = {
  site: string
  url: string
  name: string
  price: number
  currency?: string
  description?: string
  seller?: string
  rating?: number
  review_count?: number
  reviews_sample?: string[]
  gtin?: string
  category?: string
  image_url?: string
}

type Verdict = {
  verdict: 'buy' | 'wait' | 'avoid'
  explanation: string
  alternatives: Array<{ site: string; price: number; url?: string }>
  coach_note?: string
  cached?: boolean
  sources: { extraction: string; budget: string; trust: string }
}

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

async function llm(env: CoachEnv, prompt: string): Promise<string> {
  const out = (await env.AI.run(MODEL, { messages: [{ role: 'user', content: prompt }] })) as {
    response?: string
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = typeof out.response === 'string' ? out.response : (out.choices?.[0]?.message?.content ?? '')
  if (!content) throw new Error('empty model output')
  return content
}

function extractJson<T>(content: string): T {
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('no JSON in model output')
  return JSON.parse(match[0]) as T
}

const STEP1_SYSTEM = `You extract structured product facts from raw e-commerce data. Return ONLY JSON:
{"category":"Electronics > Headphones","condition":"new"|"refurbished"|"used","specs":"short one-line spec summary","trust_flags":["flag1"]|[]}
Use the product name, description and reviews. trust_flags lists seller/quality red flags you notice, else empty.`

const STEP3_SYSTEM = `You are a shopping trust analyst. Given a product and its reviews, return ONLY JSON:
{"sentiment":"positive"|"mixed"|"negative","seller_reputation":"good"|"unknown"|"poor","price_reasonableness":"fair"|"high"|"low","risk":"low"|"medium"|"high"}`
async function step1(env: CoachEnv, p: ScrapedProduct) {
  const raw = JSON.stringify({ name: p.name, price: p.price, description: p.description, seller: p.seller, reviews: p.reviews_sample })
  return extractJson<{ category: string; condition: string; specs: string; trust_flags: string[] }>(
    await llm(env, `${STEP1_SYSTEM}\n\nProduct data:\n${raw.slice(0, 4000)}`)
  )
}

async function step3(env: CoachEnv, p: ScrapedProduct) {
  const raw = JSON.stringify({ name: p.name, price: p.price, seller: p.seller, rating: p.rating, reviews: p.reviews_sample })
  return extractJson<{ sentiment: string; seller_reputation: string; price_reasonableness: string; risk: string }>(
    await llm(env, `${STEP3_SYSTEM}\n\nProduct data:\n${raw.slice(0, 4000)}`)
  )
}

async function step4(env: CoachEnv, p: ScrapedProduct, s1: unknown, s3: unknown, budget: unknown, price: unknown) {
  const system = `You are the Cartis financial coach. Decide if the user should buy now, wait, or avoid this product.
Return ONLY JSON:
{"verdict":"buy"|"wait"|"avoid","explanation":"2-3 plain-English sentences","alternatives":[{"site":"amazon.in","price":14500}]|[],"coach_note":"how this affects the user's goals"}`
  const context = {
    name: p.name,
    price: p.price,
    extraction: s1,
    trust: s3,
    budget: budget ?? 'unavailable',
    price_index: price ?? 'unavailable',
  }
  return extractJson<Omit<Verdict, 'cached' | 'sources'>>(
    await llm(env, `${system}\n\nProduct: ${JSON.stringify(context).slice(0, 4000)}`)
  )
}

async function priceIndex(env: CoachEnv, p: ScrapedProduct): Promise<unknown | null> {
  if (!p.gtin) return null
  const raw = await env.SESSIONS.get(`price_index:${p.gtin}`)
  return raw ? (JSON.parse(raw) as unknown) : null
}

async function budgetCheck(env: CoachEnv, price: number): Promise<unknown | null> {
  const res = await fetch(`${env.BACKEND_URL}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cartis-backend-secret': env.BACKEND_SECRET,
    },
    body: JSON.stringify({
      query: `query { affordabilityCheck(productPrice: ${price}) { verdict reason tabRemaining deferredRemaining } }`,
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: { affordabilityCheck?: unknown } }
  return json.data?.affordabilityCheck ?? null
}

export async function analyzeProduct(env: CoachEnv, p: ScrapedProduct): Promise<Verdict> {
  const cacheKey = `coach:${p.site}:${p.gtin ?? p.url}`
  const cached = await env.SESSIONS.get(cacheKey)
  if (cached) return { ...(JSON.parse(cached) as Verdict), cached: true }

  // Step 1: extraction
  let s1: unknown
  try {
    s1 = await step1(env, p)
  } catch (e) {
    throw new Error(`cannot analyze this product: ${String(e)}`)
  }

  // Step 2 (parallel): RAG (Vectorize), budget (Rust backend), price index (KV)
  // ponytail: Vectorize index is not provisioned — degrades to null per coach.md
  // fallback. Wire env.VECTORIZE when the index exists.
  const [budget, price] = await Promise.all([
    budgetCheck(env, p.price).catch(() => null),
    priceIndex(env, p).catch(() => null),
  ])

  // Step 3: trust check
  let s3: unknown = null
  try {
    s3 = await step3(env, p)
  } catch {
    // conservative default per fallback strategy
    s3 = { sentiment: 'unknown', seller_reputation: 'unknown', price_reasonableness: 'unknown', risk: 'high' }
  }

  // Step 4: verdict
  let verdict: Omit<Verdict, 'cached' | 'sources'>
  try {
    verdict = await step4(env, p, s1, s3, budget, price)
  } catch {
    verdict = {
      verdict: 'wait',
      explanation: 'We could not reach the coach model. Based on the listed price alone, consider waiting.',
      alternatives: [],
      coach_note: budget === null ? 'Your current budget state was not available for this check.' : undefined,
    }
  }
  if (verdict.verdict !== 'buy' && verdict.verdict !== 'wait' && verdict.verdict !== 'avoid') verdict.verdict = 'wait'

  const result: Verdict = {
    ...verdict,
    sources: {
      extraction: s1 ? 'ai' : 'none',
      budget: budget ? 'live' : 'unavailable',
      trust: s3 ? 'ai' : 'fallback',
      ...(price ? { price: 'kv' } : {}),
    },
  }
  await env.SESSIONS.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
  return result
}
