import { detectProduct, type ScrapedProduct } from "./lib/scraper.js";
import { analyzeProduct, type Verdict } from "./lib/api.js";

const OVERLAY_ID = "cartis-overlay";

let lastUrl = location.href;

function money(n: number, currency: string): string {
  const symbol: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "CA$", AUD: "A$", CHF: "CHF" };
  return `${symbol[currency] ?? ""}${n.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}`;
}

function renderOverlay(verdict: Verdict, product: ScrapedProduct): void {
  removeOverlay();
  const el = document.createElement("div");
  el.id = OVERLAY_ID;

  const tone = verdict.verdict === "buy" ? "good" : verdict.verdict === "wait" ? "warning" : "bad";
  const icon = verdict.verdict === "buy" ? "✅" : verdict.verdict === "wait" ? "⚠️" : "❌";
  const color = tone === "good" ? "#22c55e" : tone === "warning" ? "#f59e0b" : "#ef4444";

  const alts = (verdict.alternatives ?? [])
    .map(
      (a) =>
        `<a href="${a.url ?? "#"}" target="_blank" rel="noreferrer">${a.site} — ${money(a.price, product.currency)}</a>`,
    )
    .join("<br>");

  el.innerHTML = `
    <div class="cartis-overlay cartis-verdict-${tone}" style="position:fixed;top:16px;right:16px;z-index:2147483647;max-width:320px;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.25);padding:14px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.4;color:#111;border-left:4px solid ${color}">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <strong>${icon} Cartis verdict: ${verdict.verdict.toUpperCase()}</strong>
        <button id="cartis-close" style="border:0;background:none;cursor:pointer">✕</button>
      </div>
      <p style="margin:8px 0">${verdict.explanation}</p>
      ${alts ? `<div style="font-size:12px">Cheaper alternatives:<br>${alts}</div>` : ""}
      <div style="margin-top:8px;font-size:12px;color:#666">
        ${product.name}<br>${money(product.price, product.currency)}
        ${verdict.cached ? "<br><em>using cached analysis</em>" : ""}
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector("#cartis-close")?.addEventListener("click", removeOverlay);
}

function removeOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

async function analyze(): Promise<void> {
  const product = detectProduct();
  if (!product) return;
  try {
    const verdict = await analyzeProduct(product);
    renderOverlay(verdict, product);
  } catch {
    // no overlay on transient failures; try again on next page change
  }
}

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    void analyze();
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

void analyze();
