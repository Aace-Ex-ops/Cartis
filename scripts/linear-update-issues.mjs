// Updates CARTIS-103/104/105 with shipped status + comments.
// Reads API key from ~/.linear/api-key.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "0b025df9-2525-42f7-b8eb-a1c62cfcc3eb";
const STATES = {
  Backlog: "19936bd9-2908-4b68-a632-ebf29a99ae2d",
  InProgress: "1713baac-737a-44f4-a473-1e2866d56535",
  Done: "37f90851-23e9-4ab2-a065-a5313a9579db",
};
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const API = "https://api.linear.app/graphql";

const updates = [
  {
    identifier: "CARTIS-103",
    state: "Done",
    comment: `**Shipped** (commit \`74fe97c\`, gateway deploy \`10dad121\`).

Alternatives for coach verdicts now come from **Exa AI** instead of SerpAPI (same \`[]\` fallback behavior):
- query 1 = GTIN keyword; fallback 2 = \`"{name}" price\` (max 2 calls)
- price regex \`₹|INR|Rs\`, site = result URL hostname
- 24h KV cache \`exa:<gtin>\`; sources marker \`'exa'\`
- graceful \`[]\` without a key — degrades silently

Remaining user action: provide the Exa API key → \`printf '<key>' | npx wrangler secret put EXA_API_KEY --name cartis-gateway\`. No redeploy needed (secret picks up automatically).`,
  },
  {
    identifier: "CARTIS-104",
    state: "InProgress",
    comment: `**Code shipped + verified live** (commit \`3d3e7c6\`, gateway \`fc946bd1\`, backend rebuilt+restarted).

Backend \`send_email\` now POSTs to gateway \`/api/email\` (x-cartis-backend-secret) → Resend with the **worker's valid send-only key** (instance key is dead). Dropped \`lettre\`. Same pattern as \`revoke_gateway_sessions\`.

Verified: proxy returns \`{"ok":true}\` to key owner \`dsjzcjmsh6@privaterelay.appleid.com\`.

Remaining user action: **verify a domain in Resend** (resend.com/domains — can be \`cartis.dpdns.org\` once digiplat zone is live, or any domain you own). Then set \`EMAIL_FROM=Cartis <no-reply@yourdomain>\` var on the gateway. Until then, sends to non-owner addresses return 403 (test-sender restriction).`,
  },
  {
    identifier: "CARTIS-105",
    state: "Done",
    comment: `**Shipped + deployed** (commits \`8339d11\` scheduler map + \`2277f41\` boundary normalize; backend rebuilt + restarted Aug 9).

Root cause: \`coach_insights.role\` has \`CHECK role IN ('consumer','seller')\` but the scheduler passed \`personal\`/\`business\` (user_type vocabulary) and GraphQL resolvers passed raw client-supplied roles. Every INSERT failed → weekly insights silently missing, constraint error every ~5s.

Fix: \`normalize_role()\` maps \`seller|business → seller\`, else \`consumer\`, applied at \`query\`/\`refresh\`/\`save\` entry so all callers are covered. Confirmed: zero constraint errors after restart.`,
  },
];

async function gql(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors[0].message));
  return json.data;
}

for (const u of updates) {
  const { issues } = await gql({
    query: `query { issues(filter: { team: { id: { eq: "${TEAM_ID}" } } }, first: 100) { nodes { id identifier state { id name } } } }`,
  });
  const match = issues.nodes.find((i) => i.identifier === u.identifier);
  if (!match) {
    console.log(`${u.identifier}: NOT FOUND`);
    continue;
  }
  const id = match.id;
  await gql({
    query: `mutation { issueUpdate(id: "${id}", input: { stateId: "${STATES[u.state]}" }) { success } }`,
  });
  await gql({
    query: `mutation { commentCreate(input: { issueId: "${id}", body: ${JSON.stringify(u.comment)} }) { success } }`,
  });
  console.log(`${u.identifier}: -> ${u.state} + comment`);
}
