type CoachEnv = { AI: Ai; SESSIONS: KVNamespace; BACKEND_URL: string; BACKEND_SECRET: string; EXA_API_KEY?: string }

const DEFAULT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

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
  sources: { extraction: string; budget: string; trust: string }
}

async function llm(env: CoachEnv, prompt: string, model?: string): Promise<string> {
  const out = (await env.AI.run(model || DEFAULT_MODEL, { messages: [{ role: 'user', content: prompt }] })) as {
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
async function step1(env: CoachEnv, p: ScrapedProduct, model?: string) {
  const raw = JSON.stringify({ name: p.name, price: p.price, description: p.description, seller: p.seller, reviews: p.reviews_sample })
  return extractJson<{ category: string; condition: string; specs: string; trust_flags: string[] }>(
    await llm(env, `${STEP1_SYSTEM}\n\nProduct data:\n${raw.slice(0, 4000)}`, model)
  )
}

async function step3(env: CoachEnv, p: ScrapedProduct, model?: string) {
  const raw = JSON.stringify({ name: p.name, price: p.price, seller: p.seller, rating: p.rating, reviews: p.reviews_sample })
  return extractJson<{ sentiment: string; seller_reputation: string; price_reasonableness: string; risk: string }>(
    await llm(env, `${STEP3_SYSTEM}\n\nProduct data:\n${raw.slice(0, 4000)}`, model)
  )
}

async function step4(env: CoachEnv, p: ScrapedProduct, s1: unknown, s3: unknown, budget: unknown, model?: string) {
  const system = `You are the Cartis financial coach. Decide if the user should buy now, wait, or avoid this product.
Return ONLY JSON:
{"verdict":"buy"|"wait"|"avoid","explanation":"2-3 plain-English sentences","coach_note":"how this affects the user's goals"}`
  const context = {
    name: p.name,
    price: p.price,
    extraction: s1,
    trust: s3,
    budget: budget ?? 'unavailable',
  }
  return extractJson<Omit<Verdict, 'sources' | 'alternatives'>>(
    await llm(env, `${system}\n\nProduct: ${JSON.stringify(context).slice(0, 4000)}`, model)
  )
}

// Real alternatives via Exa AI (works from Cloudflare IPs; Indian aggregators 403 datacenter traffic).
// Single query "<name>" price India. Bare-GTIN queries match junk (digits hit
// model numbers), so the name query is primary.
async function alternativesFromExa(env: CoachEnv, p: ScrapedProduct): Promise<Array<{ site: string; price: number; url?: string }>> {
  if (!p.gtin || !env.EXA_API_KEY) return []
  const out: Array<{ site: string; price: number; url?: string }> = []
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${env.EXA_API_KEY}` },
      body: JSON.stringify({
        query: `"${p.name}" price India`,
        type: 'auto',
        numResults: 8,
        userLocation: 'IN',
        contents: { text: { maxCharacters: 1500 } },
      }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: Array<{ url: string; title?: string; text?: string }> }
    if (!data.results) return []
    for (const r of data.results) {
      if (out.length >= 5) break
      const m = `${r.title ?? ''} ${r.text ?? ''}`.match(/(?:₹|INR|Rs\.?)\s?([\d,]+(?:\.\d{1,2})?)/i)
      if (!m) continue
      const price = parseFloat(m[1].replace(/,/g, ''))
      // sanity: below half the observed price is an accessory/wrong product on the page
      if (!price || price < p.price * 0.5) continue
      let site = 'store'
      try {
        site = new URL(r.url).hostname.replace(/^www\./, '')
      } catch {
        /* keep default */
      }
      out.push({ site, price, url: r.url })
    }
  } catch {
    return []
  }
  const deduped = out.filter((x, i) => out.findIndex((y) => y.site === x.site) === i).slice(0, 5)
  return deduped
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

export async function analyzeProduct(env: CoachEnv, p: ScrapedProduct, model?: string): Promise<Verdict> {
  // Step 1: extraction
  let s1: unknown
  try {
    s1 = await step1(env, p, model)
  } catch (e) {
    throw new Error(`cannot analyze this product: ${String(e)}`)
  }

  // Step 2 (parallel): budget (Rust backend). RAG and price-index history were
  // dropped with the KV AI caches — see plan doc.
  const budget = await budgetCheck(env, p.price).catch(() => null)

  // Real alternatives from Exa AI (code, never the model — no hallucinated prices).
  const realAlternatives = await alternativesFromExa(env, p).catch(() => [])

  // Step 3: trust check
  let s3: unknown = null
  try {
    s3 = await step3(env, p, model)
  } catch {
    // conservative default per fallback strategy
    s3 = { sentiment: 'unknown', seller_reputation: 'unknown', price_reasonableness: 'unknown', risk: 'high' }
  }

  // Step 4: verdict
  let verdict: Omit<Verdict, 'sources' | 'alternatives'>
  try {
    verdict = await step4(env, p, s1, s3, budget, model)
  } catch {
    verdict = {
      verdict: 'wait',
      explanation: 'We could not reach the coach model. Based on the listed price alone, consider waiting.',
      coach_note: budget === null ? 'Your current budget state was not available for this check.' : undefined,
    }
  }
  if (verdict.verdict !== 'buy' && verdict.verdict !== 'wait' && verdict.verdict !== 'avoid') verdict.verdict = 'wait'

  const result: Verdict = {
    ...verdict,
    alternatives: realAlternatives,
    sources: {
      extraction: s1 ? 'ai' : 'none',
      budget: budget ? 'live' : 'unavailable',
      trust: s3 ? 'ai' : 'fallback',
      ...(realAlternatives.length ? { alternatives: 'exa' } : {}),
    },
  }
  return result
}
