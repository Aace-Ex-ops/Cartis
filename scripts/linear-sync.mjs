// Marks shipped Linear issues Done + comments reflecting actual shipped state.
// Reads API key from ~/.linear/api-key. Idempotent-ish (comments duplicated on rerun).
// Usage: node scripts/linear-sync.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "0b025df9-2525-42f7-b8eb-a1c62cfcc3eb";
const STATES = {
  Backlog: "19936bd9-2908-4b68-a632-ebf29a99ae2d",
  Todo: "db93017c-43a6-4c27-afc0-da8fae37a9ec",
  InProgress: "1713baac-737a-44f4-a473-1e2866d56535",
  Done: "37f90851-23e9-4ab2-a065-a5313a9579db",
};
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const API = "https://api.linear.app/graphql";

const actions = [
  {
    id: "CARTIS-64",
    state: "Done",
    comment:
      "All children shipped Aug 7: goals/portfolio/actions UI (43ebbdb, deploy 3fd3254c), tools (e05cbb1, e2f0d59), tool modes (gateway deploy eca5cfa0).",
  },
  { id: "CARTIS-65", state: "Done", comment: "Shipped Aug 7 (43ebbdb, deploy 3fd3254c): /dashboard/goals CRUD + progress bars, defaults from profile." },
  { id: "CARTIS-66", state: "Done", comment: "Shipped Aug 7 (43ebbdb, deploy 3fd3254c): /dashboard/portfolio add/delete/update-price, allocation bars, invested/current/returns header." },
  { id: "CARTIS-67", state: "Done", comment: "Shipped Aug 7: gateway /api/tools/retirement (deploy eca5cfa0) — 12%/6% assumptions, 4% SWR, corpus/SIP solver." },
  { id: "CARTIS-68", state: "Done", comment: "Shipped Aug 7: gateway /api/tools/tax (deploy eca5cfa0) — FY26-27 new-vs-old, 80C/80D/HRA, 87A rebate." },
  { id: "CARTIS-69", state: "Done", comment: "Shipped Aug 7 (43ebbdb, deploy 3fd3254c): user_actions query + rule-based generation + dashboard cards with Done/Dismiss." },
  { id: "CARTIS-70", state: "Done", comment: "Shipped Aug 7 (e05cbb1, e2f0d59): chat_sessions.tool column + per-tool system prompts + routing." },
  {
    id: "CARTIS-74",
    state: "Done",
    comment:
      "Resolved Aug 8: deploy path moved to SSM-only (AWS-RunShellScript send-command; cargo lives at /home/ubuntu/.cargo/bin, not in SSM PATH). Backend + migrations now deploy via SSM successfully — SSH no longer required. See NOTES.md 'Infra quickies'.",
  },
  {
    id: "CARTIS-75",
    state: "Done",
    comment:
      "Epic shipped Aug 7 (children 76-80 Done; commits d77a634/9486fda, deploy 63014ada). Aug 8 gap-closing round — all verified end-to-end: (1) LLM executive summary in /api/advisor/strategies + deterministic execSummary fallback (always present in response); (2) business_type persisted (users table, updateUserType mutation, savedBusinessType gateway fallback — advisor endpoints honor saved type when body omits it); (3) Export PDF button wired to real Polar checkout (Cartis Monthly 55681814-5a2b-4312-94c0-6fef945fc0ed) when not Pro. Tested: saved d2c type round-trips, D2C benchmarks applied, checkout returns Polar URL, entitlement OK.",
  },
  { id: "CARTIS-90", state: "Done", comment: "Shipped Aug 9: all 16 dashboard routes restyled to the Wise Web pattern (gray canvas, white cards, 0.75rem radius) in the Aug 8-9 restyle commits; gray tokens applied product-wide today (1aea202, gateway deploy 703aae1f)." },
  { id: "CARTIS-91", state: "Done", comment: "Shipped Aug 9: per-tool/section views exist on all 16 routes (seller + consumer pages incl. coach 419, tools 307, portfolio 298, goals 224 lines) — Wise-style section headers, cards, hero balance; visual consistency now enforced by shared tokens (1aea202)." },
  { id: "CARTIS-92", state: "Done", comment: "Shipped Aug 9 (1aea202): tabular-nums applied to every money render — wallet-card, tab-gauge, category-breakdown, analysis-list, tax-card, seller stat-card (en-IN toLocaleString values in tabular numerals)." },
  { id: "CARTIS-97", state: "Done", comment: "Shipped Aug 9 (1aea202, deploy 703aae1f): globals.css :root replaced Cartis cream (#E9E4D8 canvas, #F4EFE4 cards) with Wise gray tokens — canvas #F2F4F5, cards/popover/sheet #FFFFFF, borders/inputs #D8DDE2, muted #EEF0F2, secondary/accent #E8EBED, muted-foreground #5F6672, radius 0.75rem; sidebar white + gray border; charts adjusted (accent #F26A4B, neutral #2E2E2E/#5F6672/#A8B0BA/#D8DDE2)." },
  { id: "CARTIS-101", state: "Done", comment: "Shipped Aug 9 (1aea202): shared EmptyState component (icon tile + status badge + title + description + optional CTA); not-found rebuilt as 'Lost in the ledger?' 404, new app/error.tsx, /maintenance ('We'll be right back'), /restricted ('This area isn't for you') pages." },
  { id: "CARTIS-106", state: "Done", comment: "Shipped Aug 9 (a209bc7, deploy 703aae1f): user-menu trimmed — display-only avatar/name/email header row with Consumer/Seller badge, menu = Subscription | Settings | Switch account | Sign out; PANELS reduced to subscription + settings." },
  { id: "CARTIS-107", state: "Done", comment: "Shipped Aug 9 (a209bc7, deploy 703aae1f): settings-panel.tsx rebuilt as a hub — left nav (Settings | Profile | Support | Terms), existing settings content extracted to internal SettingsSection, reuses ProfilePanel/SupportPanel/TermsPanel; user-menu dialog max-w-3xl." },
  { id: "CARTIS-108", state: "Done", comment: "Shipped Aug 9 (a209bc7, deploy 703aae1f): model-switcher.tsx dropdown above the TwinChat composer (Llama 4 Scout default, Llama 3.3 70B, Llama 3.1 8B; reads me.aiModel, writes setAiModel); model-panel.tsx deleted." },
];

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function byIdentifier(id) {
  const d = await gql(`query($id: String!) { issue(id: $id) { id state { name } } }`, { id });
  return d.issue;
}

for (const a of actions) {
  const issue = await byIdentifier(a.id);
  if (!issue) {
    console.log(`!! ${a.id} not found`);
    continue;
  }
  if (issue.state.name !== a.state) {
    await gql(`mutation { issueUpdate(id: "${issue.id}", input: { stateId: "${STATES[a.state]}" }) { success } }`);
    console.log(`${a.id}: ${issue.state.name} -> ${a.state}`);
  } else {
    console.log(`${a.id}: already ${a.state}`);
  }
  if (a.comment) {
    await gql(`mutation { commentCreate(input: { issueId: "${issue.id}", body: ${JSON.stringify(a.comment)} }) { success } }`);
    console.log(`${a.id}: comment added`);
  }
}
