// One-off: creates this session's Linear issue (llama-only twin + full profile context + tiered cache).
// Idempotent by title. Usage: node scripts/linear-twin-profile.mjs
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
    title: "AI Twin: llama-only (scout), full profile context, tiered context cache, Groq removed",
    state: "Done",
    description: `Free-tier twin on @cf/meta/llama-4-scout-17b-16e-instruct only; Groq subsystem deleted; every chat gets the full user profile.

- **Model**: DEFAULT_MODEL scout; normalize_model collapses any non-scout value (legacy groq/70b/8b) to scout, no migration; model resolved before context build; UI model-switcher lists only Llama 4 Scout; gateway guards non-@cf/ aiModel (src/index.ts:1035). Verified: llama-4-scout (131k ctx) has no CF prefix caching on free tier — frontier caching models are Paid-access only (deepseek/kimi/glm), kept for a future paid tier.
- **Full profile context** (api/src/chat.rs build_context): profile + health score 750/plan + missing-info asks (investment %, EMI/debt), all goals w/ target_date + progress %, all holdings + portfolio/class totals, all accounts + account_type, seller business identity + income streams. Consumer & seller verified live (test user 340b6f7b).
- **Tiered cache**: ContextTier Full/Compact (>=96k ctx -> Full), apply_cap keeps compact shape byte-identical to old behavior; chat_context cache key now {tier:?} suffix, TTL 60s -> 900s; x-session-affinity header + chat usage log on /usage.
- **Deployed**: commit f36d24e pushed (preview/ui-redesign); EC2 binary live (groq vars purged from .env); gateway preview cartis-gateway-preview f85f88ea; prod untouched (78f5e72d after rollback of accidental bare deploy). Tests: tier_maps_by_window, compact_caps_keep_today_s_shape, non_default_models_normalize_to_scout — 3/3 pass.`,
  },
  {
    title: "AI Twin: pro-gated image input (product purchases/inventory) + voice input",
    state: "Backlog",
    description: `Future scope, after Pro subscription:
- **Image upload (Pro)**: seller uploads a receipt/photo; extract "which product was bought / added to inventory". llama-4-scout is natively vision-capable on the CF free AI.run path. Msg is role+content:String today — needs image parts; gate on users.plan (free/enterprise) and reuse chat context pattern.
- **Voice input (Max)**: CF @cf/openai/whisper-large-v3-turbo (free tier) -> text -> existing chat path.`,
  },
];

async function gql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function findByTitle(title) {
  const d = await gql(
    `{ issues(filter: { team: { id: { eq: "${TEAM_ID}" } }, title: { eq: ${JSON.stringify(title)} } }, first: 1) { nodes { id identifier } } }`,
  );
  return d.issues.nodes[0] ?? null;
}

for (const issue of issues) {
  const existing = await findByTitle(issue.title);
  if (existing) {
    console.log(`skip ${existing.identifier} (exists)`);
    continue;
  }
  const d = await gql(
    `mutation { issueCreate(input: { teamId: "${TEAM_ID}", title: ${JSON.stringify(issue.title)}, description: ${JSON.stringify(issue.description)}, stateId: "${STATES[issue.state]}" }) { issue { identifier } } }`,
  );
  console.log(`created ${d.issueCreate.issue.identifier}`);
}