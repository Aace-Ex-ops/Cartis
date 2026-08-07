// Creates/updates Cartis Linear issues (CARTIS-29..35) from this session's work.
// Reads API key from ~/.linear/api-key. Idempotent: skips issues that already exist by title.
// Usage: node scripts/linear.mjs
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

const issues = [
  {
    title: "Setu AA integration (proxy, payload, webhook, creds)",
    state: "Done",
    description: `## Done
- **Setu proxy (EC2)**: Setu APIs require Indian IPs; Cloudflare egress is not. \`/setu-proxy\` route on EC2 backend (ap-south-1), gated by \`x-cartis-backend-secret\`. Server-only at \`/home/ubuntu/api-src/src/main.rs\` (NOT in local api/ repo). Gateway \`setuProxy\`/\`getSetuToken\`/\`setuFetch\` route all Setu traffic through \`{BACKEND_URL}/setu-proxy\`.
- **AA routes (gateway)**: \`/api/aa/consent\`, \`/api/aa/status/:consentId\`, \`/api/aa/fetch\`, \`/api/aa/reconnect\` — commit \`b44676f\`.
- **Consent payload fixes**: \`frequency.value\`/\`dataLife.value\` must be numbers; \`frequency.unit\` is \`MONTH\` (docs' \`MONTHLY\` wrong); purpose "Customer spending patterns, budget or other reportings" — commit \`05aeba7\`.
- **Setu webhook**: \`POST /webhooks/setu\` + \`/v1/consents/notify\` + \`/v1/fi/notify\`, stores CONSENT_STATUS_UPDATE / SESSION_STATUS_UPDATE in KV; \`/api/aa/status\` reads cache before polling Setu — commit \`ea6465e\`.
- **Credential lifecycle**: 3 products swapped via \`wrangler secret put\` + redeploy; current product \`0ecc45d8-63c7-4c1b-8b47-116819ea82f2\` (deployed \`b3d0b42b\`).
- **Webhook registered on Bridge** by owner.
- **UI**: aa-connect flow (PR #5, \`50b2df8\`).`,
  },
  {
    title: "Setu sandbox consent creation 500 (blocked on Setu side)",
    state: "InProgress",
    description: `\`POST https://fiu-sandbox.setu.co/v2/consents\` always returns \`InternalServerError\` — "ConsentObjectCreationFailure: internal error while fetching consent details from upstream AA".

## Evidence it's Setu-side
- 3 different products on same FIU, identical failure
- Every payload variant: all fetchTypes, fiTypes, VUA formats (\`9876543210\`, \`@onemoney\`, \`@setu\`, \`@finvu\`, \`@anumati\`), redirectUrls, docs' minimal example body verbatim
- Auth works; account-availability works (\`9876543210\` registered on all 4 sandbox AAs); FIP list works — only consent creation fails
- Webhook registered on Bridge; still 500

TraceIds: \`1-6a757f0c-5cb1e5bf345f47a948dec5eb\`, \`1-6a757d2c-304300ab27f18dda0aa2cf3c\`, \`1-6a757c5c-3534e6763f7d30d67e90b42c\`, \`1-6a756612-3e797ef8218d056963e5b48b\`.

## Remaining variables
- Bridge KYC not done by owner (docs say sandbox shouldn't need it — cheapest untested variable)
- Support email to support@setu.co pending
- Production additionally needs Sahamati FIU certification + regulated-entity license — AA may be sandbox-only
- Alternative AAs (Finvu/OneMoney/Anumati sandboxes) share the Sahamati spec — payload/code ~90% portable`,
  },
  {
    title: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
    state: "Backlog",
    description: `India-adapted "Kiro Money"-class features, no external data deps (works with manual entry + profile).

- **Financial goals**: \`financial_goals\` table (type emergency/retirement/home/education/other, target, current, deadline) + GraphQL CRUD + \`dashboard/goals\` UI with progress bars; defaults from profile (emergency = 6× monthly_spend)
- **Portfolio (manual)**: \`holdings\` table (equity/mutual_fund/fd/gold/cash/other) + \`portfolio\` aggregate query (invested, current, returns, allocation) + \`dashboard/portfolio\` UI
- **Retirement calculator**: gateway \`/api/tools/retirement\` — age, SIP, corpus → projected corpus (12%), 4% SWR monthly income in today's ₹, shortfall vs target
- **Tax optimizer (India)**: gateway \`/api/tools/tax\` — 80C headroom, 80D, HRA vs standard deduction, old vs new regime, from profile
- **Structured actions**: \`user_actions\` table (open_fd/book_advisor/create_budget/tax_savings/retirement_review, status suggested/done/dismissed) + rule-based + AI generation + dashboard cards
- **Agent tool modes**: \`chat_sessions.tool\` column + per-tool system prompts + context builders; routing in gateway \`/api/coach/chat\` and chat UI

Deploy: schema.sql append + psql; backend build/scp/systemd; gateway \`wrangler deploy\`; UI \`npm run build\`.
NOTE: ui/AGENTS.md warns this Next.js version has breaking changes — read \`node_modules/next/dist/docs\` before UI work.`,
  },
  {
    title: "Kiro Phase 1: financial goals",
    state: "Backlog",
    description: "Table + GraphQL CRUD + dashboard/goals UI. See parent epic for details.",
    parent: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
  },
  {
    title: "Kiro Phase 1: portfolio holdings (manual entry)",
    state: "Backlog",
    description: "holdings table + portfolio aggregate + dashboard/portfolio UI. See parent epic.",
    parent: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
  },
  {
    title: "Kiro Phase 1: retirement calculator",
    state: "Backlog",
    description: "Gateway /api/tools/retirement (auth, profile defaults). See parent epic.",
    parent: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
  },
  {
    title: "Kiro Phase 1: tax optimizer (India)",
    state: "Backlog",
    description: "Gateway /api/tools/tax — 80C/80D/HRA/regimes. See parent epic.",
    parent: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
  },
  {
    title: "Kiro Phase 1: structured actions (CTAs)",
    state: "Backlog",
    description: "user_actions table + rule/AI generation + dashboard cards. See parent epic.",
    parent: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
  },
  {
    title: "Kiro Phase 1: AI assistant tool modes",
    state: "Backlog",
    description: "chat_sessions.tool column, per-tool prompts/context, routing. See parent epic.",
    parent: "Kiro-style Phase 1: goals, portfolio, tax, retirement, actions, agent modes",
  },
  {
    title: "Kiro Phase 2: live data (stocks, housing, real transactions)",
    state: "Backlog",
    description: `- **Stock analyzer**: gateway \`/api/tools/stock?symbol=\` + KV cache; feed chosen: **Twelve Data** free tier (~800 calls/day, NSE/BSE)
- **Housing**: NHB Residex likely scrape-blocked (foreign+datacenter IP pattern) — plan is embedded yearly Residex snapshot + AI analysis
- **Real transactions/investments**: via statement-import or extension-scrape workaround (Setu blocked)`,
  },
  {
    title: "Kiro Phase 3: live AA sync",
    state: "Backlog",
    description: "Swap manual entry for live AA data when Setu (or Finvu alternative) consent creation works.",
  },
  {
    title: "Extension: real price alternatives (currently LLM-hallucinated)",
    state: "Backlog",
    description: `\`coach.ts\` step 4 asks the LLM to invent \`alternatives\` prices — hallucinated, not real. \`price_index:<gtin>\` KV never written.

Aggregators (MySmartPrice, Smartprix, CamelCamel, PriceHistory India API) 403 foreign + datacenter IPs — same wall as Setu. Candidate paths (undecided): SerpAPI Google Shopping (paid, any IP), PriceHistory India API (free key, IP tolerance unverified), own price history from own traffic (free, cold start).`,
  },
  {
    title: "Infra: EC2 SSH unreachable from Mac",
    state: "Todo",
    description: `SSH to \`18.60.39.208\` AND to discovered instance \`47.129.171.196\` (ap-southeast-1, sg-0da7d4997ce6c893c allows 22 from 0.0.0.0/0, NACL allows) both time out from Mac. Was reachable earlier in session — security group/network changed or route issue. Blocks backend deploys + psql migrations from Mac.

Also: instance IP 18.60.39.208 (Mumbai) doesn't exist in AWS — backend may run elsewhere; gateway proxy still works (setu-proxy returns Setu 500s), so backend HTTPS is live somewhere.`,
  },
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

async function findByTitle(title) {
  const d = await gql(
    `query($t: String!) { issues(filter: { team: { id: { eq: "${TEAM_ID}" } }, title: { eq: $t } }, first: 1) { nodes { id identifier } } }`,
    { t: title },
  );
  return d.issues.nodes[0] ?? null;
}

async function createIssue(issue) {
  const existing = await findByTitle(issue.title);
  if (existing) {
    console.log(`skip ${existing.identifier} (exists)`);
    return existing.identifier;
  }
  const vars = {
    teamId: TEAM_ID,
    title: issue.title,
    description: issue.description ?? "",
    stateId: STATES[issue.state] ?? STATES.Backlog,
  };
  const d = await gql(
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { id identifier } } }`,
    { input: vars },
  );
  console.log(`created ${d.issueCreate.issue.identifier}`);
  return d.issueCreate.issue.identifier;
}

const created = {};
for (const issue of issues) {
  created[issue.title] = await createIssue(issue);
}

// Attach children to the epic via parentId
for (const issue of issues) {
  if (!issue.parent) continue;
  const childId = created[issue.title];
  const parentId = created[issue.parent];
  if (!childId || !parentId) continue;
  await gql(
    `mutation { issueUpdate(id: "${childId}", input: { parentId: "${parentId}" }) { issue { identifier } } }`,
  );
  console.log(`parented ${childId} -> ${parentId}`);
}
