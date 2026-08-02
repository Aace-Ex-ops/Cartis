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

// Get Done state
const { workflowStates } = await gql(
  `query($teamId: ID!) { workflowStates(first: 50, filter: { team: { id: { eq: $teamId } } }) { nodes { id name } } }`,
  { teamId: TEAM_ID }
)
const done = workflowStates.nodes.find((s) => s.name === 'Done')
if (!done) throw new Error('No Done state found')

// Create issue as Done
const { issueCreate } = await gql(
  `mutation($teamId: String!, $title: String!, $description: String!, $stateId: String!) {
    issueCreate(input: { teamId: $teamId, title: $title, description: $description, stateId: $stateId }) { issue { identifier } }
  }`,
  {
    teamId: TEAM_ID,
    title: 'Landing page UI effects + deploy consolidation',
    description: `## What was done

**DecryptedText component** — scramble-to-reveal text effect on hero heading ("Know before you spend."). Text starts as random characters and sequentially decrypts when scrolled into view (animateOn="view").

**GlareHover component** — shimmering background glare effect for interactive cards.

**Landing page cleanup** — Added Ferrofluid background animation, MetallicLogo, SpecularButton, stats section, line sidebar, stepper component.

**Auth fix** — Landing CTA now correctly shows "Go to dashboard" when logged in, "Get started free" when not. Fixed by setting \`NEXT_PUBLIC_GATEWAY_URL\` so \`getMe()\` hits the gateway on the same origin.

**Deploy consolidation** — Deleted standalone UI Cloudflare Worker (\`ui.rz8m4crnwt.workers.dev\`). Removed OpenNext/wrangler from UI. Switched \`next.config.ts\` to \`output: "export"\`. Deploy flow is now: \`cd ui && npm run build\` → \`cd gateway && npx wrangler deploy\`.

**New files:**
- \`ui/src/components/shared/decrypted-text.tsx\`
- \`ui/src/components/shared/glare-hover.tsx\`
- \`ui/src/components/shared/ferrofluid.tsx\`
- \`ui/src/components/shared/metallic-logo.tsx\`
- \`ui/src/components/shared/metallic-paint.tsx\`
- \`ui/src/components/shared/specular-button.tsx\`
- \`ui/src/components/shared/line-sidebar.tsx\`
- \`ui/src/components/shared/stepper.tsx\`

**Deleted:**
- \`ui/wrangler.jsonc\`
- \`ui/open-next.config.ts\`
- Standalone UI Worker (via \`wrangler delete\`)

**Commit:** dcfe37a on main`,
    stateId: done.id,
  }
)

console.log('created + done:', issueCreate.issue.identifier)
console.log('\nDone.')
