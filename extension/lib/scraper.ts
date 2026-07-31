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

export type SiteRule = {
  host: string;
  productPath: string;
  scrapeFn: () => Partial<ScrapedProduct> | null;
};

function text(selectors: string[]): string {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (el?.innerText) return el.innerText.trim().slice(0, 2000);
  }
  return "";
}

function price(selectors: string[]): number | undefined {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (!el) continue;
    const n = parseFloat(el.innerText.replace(/[^0-9.,]/g, "").replace(/,/g, ""));
    if (!isNaN(n)) return n;
  }
  return undefined;
}

function reviews(selectors: string[]): string[] {
  const out: string[] = [];
  for (const s of selectors) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) {
      if (el.innerText && out.length < 3) out.push(el.innerText.trim().slice(0, 300));
    }
  }
  return out;
}

export const SITE_RULES: SiteRule[] = [
  {
    host: "amazon.com",
    productPath: "/dp/",
    scrapeFn: () => ({
      name: text(["#productTitle", "h1"]),
      price: price(["span.a-price > span.a-offscreen", "#corePrice_feature_div .a-price .a-offscreen"]),
      seller: text(["#bylineInfo"]),
      rating: parseFloat(text(["#acrPopover"])?.split(" ")[0] ?? "") || undefined,
      review_count: parseInt(text(["#acrCustomerReviewText"]).replace(/[^0-9]/g, ""), 10) || undefined,
      reviews_sample: reviews(["#reviewsMedley .review-text-content span", ".review-text-content span"]),
      gtin: new URL(location.href).pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1],
    }),
  },
  {
    host: "flipkart.com",
    productPath: "/p/",
    scrapeFn: () => ({
      name: text(["span.B_NuCI", "h1"]),
      price: text(["div._30jeq3._16Jk6d"]).replace(/[^0-9]/g, "") ? parseFloat(text(["div._30jeq3._16Jk6d"]).replace(/[^0-9]/g, "")) : undefined,
      seller: text(["div._3DkUji"]),
      rating: parseFloat(text(["div._3LWZlK"])) || undefined,
      reviews_sample: reviews(["div._6K7Xyr div", "div.t-ZTKy div"]),
    }),
  },
  {
    host: "bestbuy.com",
    productPath: "/product/",
    scrapeFn: () => ({
      name: text(["h1", "h1[class*=heading]"]),
      price: price(["[data-testid='customer-price']", "div.priceView-hero-price span"]),
      rating: parseFloat(text(["[aria-label*='out of 5']"])) || undefined,
      reviews_sample: reviews([".review-item .review-text", ".c-review-body"]),
    }),
  },
];

export function detectProduct(): ScrapedProduct | null {
  const host = location.hostname.replace(/^www\./, "");
  const rule = SITE_RULES.find((r) => host.endsWith(r.host) && location.pathname.includes(r.productPath));
  if (!rule) return null;
  const scraped = rule.scrapeFn();
  if (!scraped) return null;
  if (!scraped.name || scraped.price === undefined) return null;
  return {
    site: host,
    url: location.href,
    name: scraped.name!,
    price: scraped.price!,
    currency: "INR",
    description: text(["#productDescription", "div[data-testid='description']", "meta[name='description']"]),
    seller: scraped.seller ?? "",
    rating: scraped.rating,
    review_count: scraped.review_count,
    reviews_sample: scraped.reviews_sample ?? [],
    gtin: scraped.gtin,
    category: scraped.category,
    image_url: document.querySelector<HTMLImageElement>("img#landingImage, img._396cs4, img[data-testid='image']")?.src,
  };
}
