export type ScrapedProduct = {
  site: string;
  url: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  seller: string;
  rating?: number;
  review_count?: number;
  reviews_sample: string[];
  gtin?: string;
  category?: string;
  image_url?: string;
};

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "₹": "INR",
  "Rs.": "INR",
  "Rs": "INR",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "CA$": "CAD",
  "A$": "AUD",
  "CHF": "CHF",
};

export function detectCurrency(text: string, metaCode?: string | null): string {
  if (metaCode) return metaCode.toUpperCase();
  const sym = text.match(/₹|Rs\.?|\$|€|£|¥|CA\$|A\$|CHF/);
  if (sym) return CURRENCY_BY_SYMBOL[sym[0]] ?? "";
  return "";
}

export function parsePrice(text: string): number | undefined {
  const m = text.replace(/[^0-9.,]/g, "");
  if (!m) return undefined;
  const n = parseFloat(m.replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

type JsonLd = Record<string, unknown> & { "@type"?: string | string[] };

function asArray<T>(v: unknown): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? (v as T[]) : [v as T];
}

export function isType(node: JsonLd, t: string): boolean {
  const ty = node["@type"];
  return (Array.isArray(ty) ? ty : [ty]).includes(t);
}

export function findByType(nodes: JsonLd[], t: string): JsonLd | null {
  for (const n of nodes) {
    if (isType(n, t)) return n;
    const child = findByType(asArray(n["@graph"] as JsonLd[]).filter(Boolean) as JsonLd[], t);
    if (child) return child;
  }
  return null;
}

export function collect(node: JsonLd | null, out: JsonLd[] = []): JsonLd[] {
  if (!node || typeof node !== "object") return out;
  if ("@type" in node) out.push(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) for (const item of v) collect(item as JsonLd, out);
    else if (v && typeof v === "object") collect(v as JsonLd, out);
  }
  return out;
}

function extractJsonLd(): Partial<ScrapedProduct> | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
  const nodes: JsonLd[] = [];
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.textContent ?? "");
      nodes.push(...(Array.isArray(parsed) ? (parsed as JsonLd[]) : [parsed as JsonLd]));
    } catch {
      // ignore malformed blocks
    }
  }
  const product = findByType(nodes, "Product");
  if (!product) return null;

  const offer = collect(product).find((n) => isType(n, "Offer") || (isType(n, "AggregateOffer") && "lowPrice" in n));
  const priceText = String(offer?.price ?? offer?.lowPrice ?? product.price ?? "");
  const price = parsePrice(priceText);
  if (!product.name || price === undefined) return null;

  const image = product.image ?? product.image_url;
  const rating = product.aggregateRating as JsonLd | undefined;
  return {
    name: String(product.name).trim(),
    price,
    currency: detectCurrency(priceText, (offer?.priceCurrency as string) ?? (product.priceCurrency as string) ?? undefined),
    description: String(product.description ?? "").trim(),
    seller: String((product.brand as JsonLd)?.name ?? product.brand ?? "").trim(),
    rating: rating ? parseFloat(String(rating.ratingValue)) || undefined : undefined,
    review_count: rating ? parseInt(String(rating.reviewCount), 10) || undefined : undefined,
    image_url: typeof image === "string" ? image : undefined,
    category: String((product.category as string) ?? "").trim() || undefined,
    gtin: String(product.gtin ?? product.gtin13 ?? product.gtin8 ?? "").trim() || undefined,
  };
}

const PRICE_CLASS = /(price|offer|amount|sale|product|cost|sale-price|sales)/i;
const TITLE_CLASS = /(title|name|product-title|product-name|heading)/i;

function text(el: Element | null | undefined, max = 2000): string {
  return el?.textContent?.trim().slice(0, max) ?? "";
}

function closestPriceEl(h1: Element): Element | null {
  const priceText = h1.closest("main, article, [class*='product'], [id*='product'], body")?.querySelectorAll("span, div, p, strong, ins, meta");
  if (!priceText) return null;
  let best: { el: Element; score: number } | null = null;
  for (const el of Array.from(priceText)) {
    if (el.closest("h1, h2, h3, nav, header, footer, script, style")) continue;
    const cls = `${el.className} ${el.id} ${el.getAttribute("name") ?? ""} ${el.getAttribute("itemprop") ?? ""}`;
    if (!PRICE_CLASS.test(cls) && !PRICE_CLASS.test(el.textContent ?? "")) continue;
    const n = parsePrice(el.textContent ?? "");
    if (n === undefined || n <= 0) continue;
    const score = PRICE_CLASS.test(cls) ? 2 : 1;
    if (!best || score > best.score) best = { el, score };
  }
  return best?.el ?? null;
}

function extractHeuristic(): Partial<ScrapedProduct> | null {
  const h1 = document.querySelector("h1") ?? document.querySelector<HTMLElement>("title");
  if (!h1) return null;
  const name = h1.textContent?.trim();
  if (!name || name.length < 3) return null;

  const priceEl = closestPriceEl(h1);
  const price = priceEl ? parsePrice(priceEl.textContent ?? "") : undefined;
  if (price === undefined) return null;

  const priceText = text(priceEl, 100);
  const meta = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  const title = meta?.content ?? name;
  return {
    name: title.trim().slice(0, 200),
    price,
    currency: detectCurrency(priceText, document.querySelector<HTMLMetaElement>('meta[property="product:price:currency"]')?.content ?? undefined),
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
    seller: document.querySelector<HTMLMetaElement>('meta[property="product:brand"]')?.content ?? "",
    image_url: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? undefined,
  };
}

function extractMeta(): Partial<ScrapedProduct> | null {
  const name = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim();
  const priceStr = document.querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')?.content ?? document.querySelector<HTMLMetaElement>('meta[name="product_price"]')?.content;
  const price = priceStr ? parsePrice(priceStr) : undefined;
  if (!name || price === undefined) return null;
  return {
    name: name.slice(0, 200),
    price,
    currency: detectCurrency(priceStr ?? "", document.querySelector<HTMLMetaElement>('meta[property="product:price:currency"]')?.content ?? undefined),
    description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "",
    seller: document.querySelector<HTMLMetaElement>('meta[property="product:brand"]')?.content ?? "",
    image_url: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? undefined,
  };
}

export function detectProduct(): ScrapedProduct | null {
  const scraped = extractJsonLd() ?? extractMeta() ?? extractHeuristic();
  if (!scraped) return null;
  if (!scraped.name || scraped.price === undefined || scraped.price <= 0) return null;
  return {
    site: location.hostname.replace(/^www\./, ""),
    url: location.href,
    name: scraped.name,
    price: scraped.price,
    currency: scraped.currency ?? "",
    description: scraped.description ?? "",
    seller: scraped.seller ?? "",
    rating: scraped.rating,
    review_count: scraped.review_count,
    reviews_sample: [],
    gtin: scraped.gtin,
    category: scraped.category,
    image_url: scraped.image_url,
  };
}
