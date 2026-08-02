#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.linear.app/graphql'
const KEY = process.env.LINEAR_API_KEY ?? readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'), 'utf8').match(/^LINEAR_API_KEY=(.+)$/m)?.[1]
const TEAM_ID = '0b025df9-2525-42f7-b8eb-a1c62cfcc3eb'

async function gql(query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: KEY },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { workflowStates } = await gql(
  `query($teamId: ID!) { workflowStates(first: 50, filter: { team: { id: { eq: $teamId } } }) { nodes { id name } } }`,
  { teamId: TEAM_ID }
)
const done = workflowStates.nodes.find((s) => s.name === 'Done')
if (!done) throw new Error('No Done state found')

const issues = [
  {
    title: 'Auth: existence-check flow on Google callback',
    description: `Fixed signin/signup routing on the auth callback:
- Backend: new \`googleUserByEmail(email)\` query; \`userByEmail\` returns signup-relevant data.
- Gateway: callback now checks email existence BEFORE upsert — signin + missing → \`/signup?error=no_account\`, signup + existing → \`/signin?error=already_exists\`, then upsert → \`created ? /onboarding : /dashboard\`.
- UI: error banners restored in auth-form.tsx.

Acceptance: signing in with an unregistered Google account routes to signup with a visible banner; signing up with a registered email routes to signin with a visible banner; normal flows land on /onboarding (new) or /dashboard (existing).`,
  },
  {
    title: 'Sync pipeline: paste SMS → ledger + bank account + balance (persisted)',
    description: `Real persistence behind the Sync Paste Box:
- Backend: \`addLedgerEntries(entries, balance, bankName, mobileNumber)\` — single transaction; upserts \`banks\` by name; auto-creates \`bank_accounts\` (\`gen_random_uuid()\` id); ledger inserts \`account_type='budget'\`, debit positive / credit negative; idempotency via UUIDv5 key → re-paste inserts 0; updates latest account balance + \`last_sync_at\`.
- DB: \`mobile_number\` dropped NOT NULL.
- Gateway parse: bank-name regex, balance-only detection, AI fallback only with currency markers; response includes \`bank_name\` + \`balance\`.
- UI: SyncPasteBox rewritten with honest result messages; onboarding auto-redirects to /dashboard after sync.

Acceptance: pasting an SMS creates/updates the bank account, inserts deduped ledger entries, and updates the balance shown in the wallet.`,
  },
  {
    title: 'Wallet: show real bank balance in wallet card, sidebar + /dashboard/wallet page',
    description: `Replaced the empty \`wallet_balance\` credits display with real bank data:
- WalletCard + sidebar box show bank balance from \`bankAccounts\` (first account), labeled "Bank balance".
- Removed the fake "Upgrade · 12 credits left" box.
- New \`/dashboard/wallet\` page: balance card, connected accounts list, sync entry point; sidebar wallet box links there.

Acceptance: landing on dashboard shows the connected bank balance; wallet page lists accounts and shows the latest balance.`,
  },
  {
    title: 'AI Twin: chat endpoint with live money context + /dashboard/twin page',
    description: `Stateless V1 financial coach chat:
- Gateway \`POST /api/coach/chat\` (auth-protected): fetches live context (wallet balance/tab limit, monthly tab spent, bank accounts, 30d spending) and sends it in the system prompt to \`@cf/meta/llama-4-scout-17b-16e-instruct\`, returns \`{ reply }\`.
- UI: \`/dashboard/twin\` chat page with client-side message history, Enter-to-send, sidebar nav item.

Acceptance: chatting from the AI Twin page answers with context-aware replies grounded in the user's real balance and budget.`,
  },
]

for (const { title, description } of issues) {
  const { issueCreate } = await gql(
    `mutation($teamId: String!, $title: String!, $description: String!, $stateId: String!) { issueCreate(input: { teamId: $teamId, title: $title, description: $description, stateId: $stateId }) { issue { identifier } } }`,
    { teamId: TEAM_ID, title, description, stateId: done.id }
  )
  console.log('created + done:', issueCreate.issue.identifier)
  await sleep(300)
}
console.log('\nDone.')
