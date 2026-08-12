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
    comment: `**Shipped + live-verified** (commit \`8f519e6\`, gateway deploy \`b3dd1ac3\`).

Alternatives for coach verdicts now come from **Exa AI** (key set: \`EXA_API_KEY\`):
- single query \`"<name>" price India\`, \`type: auto\`, \`userLocation: IN\`, \`contents.text.maxCharacters 1500\`
- price regex \`₹|INR|Rs\`, site = result URL hostname; sanity filter drops prices < 50% of observed (accessories/wrong products)
- 24h KV cache \`exa:<gtin>\`; sources marker \`'exa'\`
- graceful \`[]\` on any error

Fixed after checking canonical docs: Bearer auth (not \`x-api-key\`), \`type: keyword\` does not exist (→ \`auto\`), bare-GTIN queries match junk digits (name query is primary; GTIN only keys the cache).

E2E (Samsung Galaxy S24 Ultra @ ₹1,09,999): flipkart ₹79,999 · reliancedigital ₹1,19,999 · croma ₹1,29,999 · suprememobiles ₹1,29,999.`,
  },
  {
    identifier: "CARTIS-104",
    state: "InProgress",
    comment: `**Aug 10 (final): email LIVE on Resend — domain verified, real send delivered.**

Pivot for demo deadline: SES DKIM verification lagged >2h (AWS-side poll; DNS was provably correct), so \`/api/email\` reverted to **Resend** (commit \`bf56d23\`). Domain \`cartis.dpdns.org\` re-registered (\`aa9255ea\`), TXT \`resend._domainkey\` added in Cloudflare, verified in ~15 min. \`EMAIL_FROM=Cartis <no-reply@cartis.dpdns.org>\`.

**Verified live: \`{"ok":true}\` → Gmail inbox.** Backend \`email.rs\` unchanged (proxies via \`x-cartis-backend-secret\`).

SES (ap-south-2) parked in background: IAM \`cartis-worker-email\`, identity + Easy-DKIM CNAMEs in DNS, production-access request in review. When DKIM → SUCCESS, the swap is ~5 lines.`,
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
