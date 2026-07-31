#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.linear.app/graphql'
const KEY = process.env.LINEAR_API_KEY ?? readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'), 'utf8').match(/^LINEAR_API_KEY=(.+)$/m)?.[1]
const TEAM_ID = '0b025df9-2525-42f7-b8eb-a1c62cfcc3eb'
const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')

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
const read = (name) => readFileSync(join(DOCS, name), 'utf8')

const issues = [
  { title: 'Cloudflare infra: KV namespaces, Vectorize, R2, Pages', label: 'infra', docs: ['architecture.md', 'caching.md'] },
  { title: 'AWS infra: EC2 (Rust+Gleam+Python), RDS PostgreSQL, Redis, SES', label: 'infra', docs: ['architecture.md'] },
  { title: 'Polar.sh: create 4 products (wallet/monthly/annual/one-time) + webhook', label: 'infra', docs: ['payments.md'] },
  { title: 'Gateway: Google OAuth handler (/auth/login, /auth/callback)', label: 'auth', docs: ['auth.md'] },
  { title: 'Gateway: session management (KV sessions, 10-min rotation, cookie)', label: 'auth', docs: ['auth.md'] },
  { title: 'UI: scaffold ui/ — Next.js + shadcn + @react-bits registry + Spade theme', label: 'ui', docs: ['frontend.md'] },
  { title: 'UI: DashboardShell (sidebar + header + nav)', label: 'ui', docs: ['frontend.md'] },
  { title: 'UI: Onboarding page (bank dropdown, mobile, wa.me link, paste box)', label: 'ui', docs: ['bank-data.md'] },
  { title: 'UI: consumer dashboard pages (overview, analysis, budget, purchases, bank, settings)', label: 'ui', docs: ['dashboards.md', 'frontend.md'] },
  { title: 'UI: seller dashboard pages (8 routes)', label: 'ui', docs: ['dashboards.md', 'frontend.md'] },
  { title: 'Backend: Rust API scaffold (Axum + async-graphql, schema per gateway.md)', label: 'backend', docs: ['gateway.md', 'architecture.md'] },
  { title: 'Backend: bank sync parse endpoint (regex → Workers AI fallback)', label: 'backend', docs: ['bank-data.md'] },
  { title: 'Backend: health score, budget alerts, credit limits', label: 'backend', docs: ['alerts.md', 'ledger.md'] },
  { title: 'Pipeline: Gleam scaffold (price index scan, WebSocket push)', label: 'pipeline', docs: ['realtime.md', 'caching.md'] },
  { title: 'Extension: MV3 scaffold (content script, verdict overlay)', label: 'extension', docs: ['extension.md'] },
  { title: 'Extension: coach DAG integration (Workers AI steps 1-4)', label: 'extension', docs: ['coach.md'] },
  { title: 'Pipeline: Python model training scaffold', label: 'pipeline', docs: ['ai-cron.md'] },
]

// 1. Rename team
const { teamUpdate } = await gql(
  `mutation($id: String!, $name: String!, $key: String!) { teamUpdate(id: $id, input: { name: $name, key: $key }) { team { id name key } } }`,
  { id: TEAM_ID, name: 'Cartis', key: 'CARTIS' }
)
console.log('team renamed:', teamUpdate.team.name, teamUpdate.team.key)
await sleep(300)

// 2. Archive Linear default issues
const defaults = ['3c5b123b-b0e0-4915-88aa-d705040ef5c3', '98e18250-2e33-41d1-a6a2-32072b57e96b', 'ba999fa4-d1a0-4e61-91f1-fe5ffa352285', 'e32c0fb7-4238-4ae5-8d83-786788059ac7']
for (const id of defaults) {
  const { issueArchive } = await gql(`mutation($id: String!) { issueArchive(id: $id) { success } }`, { id })
  console.log('archived default issue:', issueArchive.success)
  await sleep(300)
}

// 3. Labels
const labelIds = {}
for (const label of ['infra', 'auth', 'ui', 'backend', 'extension', 'pipeline']) {
  const { issueLabelCreate } = await gql(
    `mutation($name: String!, $teamId: String!) { issueLabelCreate(input: { name: $name, teamId: $teamId }) { issueLabel { id } } }`,
    { name: label, teamId: TEAM_ID }
  )
  labelIds[label] = issueLabelCreate.issueLabel.id
  console.log('label created:', label)
  await sleep(300)
}

// 4. Project
const { projectCreate } = await gql(
  `mutation($name: String!, $description: String!, $teamIds: [String!]!) {
    projectCreate(input: { name: $name, description: $description, teamIds: $teamIds }) { project { id } }
  }`,
  { name: 'Cartis — AI Financial Coach', description: 'AI Financial Coach: browser extension verdicts, WhatsApp bank sync, consumer + seller dashboards. Full research embedded in issue descriptions (source docs).', teamIds: [TEAM_ID] }
)
const projectId = projectCreate.project.id
console.log('project created:', projectId)
await sleep(300)

// 5. Issues with verbatim docs
for (const issue of issues) {
  const body = [
    `**Source docs:** ${issue.docs.join(', ')}`,
    '',
    issue.docs.map((d) => `---\n\n# ${d}\n\n${read(d)}`).join('\n\n'),
  ].join('\n')

  const { issueCreate } = await gql(
    `mutation($title: String!, $description: String!, $teamId: String!, $projectId: String!, $labelIds: [String!]!) {
      issueCreate(input: { title: $title, description: $description, teamId: $teamId, projectId: $projectId, labelIds: $labelIds }) { issue { identifier } }
    }`,
    { title: issue.title, description: body, teamId: TEAM_ID, projectId, labelIds: [labelIds[issue.label]] }
  )
  console.log('issue created:', issueCreate.issue.identifier, '—', issue.title)
  await sleep(300)
}

console.log('\nDone. Check Linear → Project: Cartis — AI Financial Coach')
