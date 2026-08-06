import type { ScrapedProduct } from "./scraper.js";

const GATEWAY = "https://cartis-gateway.rz8m4crnwt.workers.dev";

export type Verdict = {
  verdict: "buy" | "wait" | "avoid";
  explanation: string;
  alternatives: { site: string; price: number; url?: string }[];
  coach_note?: string;
  cached?: boolean;
};

export async function graphql<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  const res = await fetch(`${GATEWAY}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export async function analyzeProduct(product: ScrapedProduct): Promise<Verdict> {
  const res = await fetch(`${GATEWAY}/api/coach/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product }),
  });
  if (!res.ok) throw new Error(`coach ${res.status}`);
  return (await res.json()) as Verdict;
}
