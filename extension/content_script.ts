import { detectProduct, type ScrapedProduct } from "./lib/scraper.js";
import { analyzeProduct, logAction, type Verdict } from "./lib/api.js";

const OVERLAY_ID = "cartis-overlay";

let lastUrl = location.href;

function money(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
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
        `<a href="${a.url ?? "#"}" target="_blank" rel="noreferrer">${a.site} — ${money(a.price)}</a>`,
    )
    .join("<br>");

  el.innerHTML = `
    <div class="cartis-overlay cartis-verdict-${tone}" style="border-left:4px solid ${color}">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <strong>${icon} Cartis verdict: ${verdict.verdict.toUpperCase()}</strong>
        <button id="cartis-close" style="border:0;background:none;cursor:pointer">✕</button>
      </div>
      <p style="margin:8px 0">${verdict.explanation}</p>
      ${alts ? `<div style="font-size:12px">Cheaper alternatives:<br>${alts}</div>` : ""}
      <div style="margin-top:8px;font-size:12px;color:#666">
        ${product.name}<br>${money(product.price)}
        ${verdict.cached ? "<br><em>using cached analysis</em>" : ""}
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector("#cartis-close")?.addEventListener("click", removeOverlay);

  chrome.runtime.onMessage.addListener(function onMsg(msg) {
    if (msg?.type === "cartis_action") {
      void logAction({
        product,
        verdict: verdict.verdict,
        user_action: msg.user_action as "bought" | "skipped" | "clicked_alternative",
        suggested_site: msg.suggested_site,
        suggested_price: msg.suggested_price,
      });
      chrome.runtime.onMessage.removeListener(onMsg);
    }
  });
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
