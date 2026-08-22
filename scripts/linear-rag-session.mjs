// One-off: creates this session's Linear issues (AI Twin memory RAG + slider + auth + redis).
// Idempotent by title. Usage: node scripts/linear-rag-session.mjs
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
    title: "AI Twin memory: drop Supermemory, pgvector RAG on own Postgres",
    state: "Todo",
    description: `Replace the write-only Supermemory mirror with real long-term memory: pgvector semantic recall over chat turns stored in our own Postgres (prod RDS, local brew).

- Remove push_supermemory/purge_supermemory + spawn + entity-context fetch (api/src/chat.rs ~1094-1246), purge call on account delete (api/src/graphql.rs 5/774), sm_push metric (api/src/usage.rs), SM_API_KEY refs. One-shot purge of user_* containers from Supermemory API before deleting code.
- CREATE EXTENSION vector (prod RDS must be PG15+; local brew postgres needs brew install pgvector) + chat_memories table (user_id, session_id, content "user:..\\nassistant:..", embedding vector(1024), created_at) + user index.
- Embed on write: async bge-m3 (@cf/baai/bge-m3) via existing CF_ACCOUNT_ID/CF_AI_TOKEN path in persist_turn; non-blocking failures.
- Retrieve on read: embed user message in chat_stream, top-4 cosine (<=>) over chat_memories, append "Past conversation memories:" section to system prompt; empty/error -> chat proceeds normally.
- Backfill: one-off script embedding existing chat_messages turns.
Children: schema, embed+retrieve, richer context, backfill.`,
  },
  {
    title: "Memory RAG: schema (vector ext + chat_memories)",
    state: "Todo",
    description: "scripts/schema.sql migration: CREATE EXTENSION IF NOT EXISTS vector; chat_memories (user_id, session_id, content, embedding vector(1024), created_at) + chat_memories_user_idx. Apply to prod RDS (verify PG15+) and local dev (brew install pgvector).",
    parent: "AI Twin memory: drop Supermemory, pgvector RAG on own Postgres",
  },
  {
    title: "Memory RAG: embed-on-write + retrieve-on-read",
    state: "Todo",
    description: "api/src/chat.rs: replace Supermemory push in persist_turn with async bge-m3 embed via existing CF AI token (chat.rs:495-504 pattern) -> INSERT chat_memories. In chat_stream (~:191): embed user msg -> SELECT content ORDER BY embedding <=> $2 LIMIT 4 -> 'Past conversation memories:' system-prompt section. Graceful on any failure.",
    parent: "AI Twin memory: drop Supermemory, pgvector RAG on own Postgres",
  },
  {
    title: "Memory RAG: richer structured context in build_context",
    state: "Todo",
    description: "api/src/chat.rs build_context (1281): personal adds profile (income/spend/invest%/housing/dependents/EMIs/tax from users), goals (financial_goals), holdings w/ value (holdings), last 5 purchases (analysis_log JOIN products), recent ledger entries, computed tax via new_regime_tax (insights.rs:10). Seller keeps finance/inventory + GST-relevant facts from real tables. Direct SQL, no RAG. Cap sections to keep prompt compact.",
    parent: "AI Twin memory: drop Supermemory, pgvector RAG on own Postgres",
  },
  {
    title: "Memory RAG: backfill existing chats + Supermemory purge",
    state: "Todo",
    description: "One-off script: group existing chat_messages into user->assistant turns, embed via bge-m3, insert into chat_memories (batched). Before deleting Supermemory code: purge all user_* container tags via their API so no user data lingers on their infra.",
    parent: "AI Twin memory: drop Supermemory, pgvector RAG on own Postgres",
  },
  {
    title: "Subscription: Usage Slider plan selector, both tabs, zero backend changes",
    state: "Todo",
    description: `Replace the 3-card plan grids with the 21st.dev select-a-plan-4 "Usage Slider" (source fetched from flexnative registry).

- New ui/src/components/ui/slider.tsx (hand-rolled <input type=range>, no radix dep; ~20 lines).
- New ui/src/components/ui/select-a-plan-4.tsx: slider card, INR, threshold->tier lookup, price = existing flat plan price/productId, CTA -> existing checkout(plan, interval). Slider max 500.
- subscription-panel.tsx: Personal tab slider 1-14 -> Free(1)/Pro(2-4)/Max(5-14); Business tab slider 15-500 -> Standard(15-99)/Premium(100-399)/Enterprise(400+). Keep tabs/interval toggle/checkout.
- NO Polar dashboard, gateway, or backend changes (no per-seat billing; seats are a plan-picker dimension only).`,
  },
  {
    title: "Signin page restyle (AuthUI look, visual-only)",
    state: "Todo",
    description: `signin-form.tsx toward 21st.dev @easemize/auth-ui aesthetic (cleaner shadcn card): larger card (max-w lg, rounded-2xl p-8, lighter shadow), "or continue with Google" divider, refined Google button (py-3) + typography (heading text-2xl semibold, subtitle text-sm).

Kept unchanged: /auth/start?provider=google&intent= flow, mode tabs + spring layoutId pill, ERRORS mapping + ?error= URL read, Back-to-Home button, MetallicLogo brand block, security footer. Routes unchanged. Deliberately no email/password fields (no credentials backend).`,
  },
  {
    title: "Redis cache layer (Rust API) + KV cleanup (gateway)",
    state: "Todo",
    description: `Redis read-through cache between Rust API and Postgres. REDIS_URL env (prod EC2 redis-server already provisioned via userdata.sh; local dev). Cache failures -> silent Postgres fallback (accelator, never a dependency).

Cache (keys cartis:{uid}:...): chat_context (build_context snapshot, TTL 60s — kills 6+ queries per chat message), dashboard resolvers (wallet/monthlyTab/ledger, goals, holdings, accounts, TTL 30-60s), chat session list + per-session messages (invalidated on persist_turn). Target invalidation on writes; whole-user bust fallback.

Gateway KV cleanup: DELETE coach:* / price_index:* / exa:* / budget AI cache reads+writes. KEEP session:*, user_sessions:*, usage:* (rate-limit counters), yodlee:*, polar:event:*, plan:* (5-min TTL), email:fail:* — worker-operational state stays in KV.`,
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