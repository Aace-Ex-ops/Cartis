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
  `query($teamId: ID!) { workflowStates(first: 50, filter: { team: { id: { eq: $teamId } } }) { nodes { id name type } } }`,
  { teamId: TEAM_ID }
)
const done = workflowStates.nodes.find((s) => s.name === 'Done')
if (!done) throw new Error('No Done state found')
console.log('Done state:', done.id)

const defaults = [
  { id: 'ba999fa4-d1a0-4e61-91f1-fe5ffa352285', title: 'Linear onboarding: Get familiar with Linear' },
  { id: '98e18250-2e33-41d1-a6a2-32072b57e96b', title: 'Linear onboarding: Connect your tools' },
  { id: 'e32c0fb7-4238-4ae5-8d83-786788059ac7', title: 'Linear onboarding: Import your data' },
  { id: '3c5b123b-b0e0-4915-88aa-d705040ef5c3', title: 'Linear onboarding: Set up your teams' },
]

for (const { id, title } of defaults) {
  const { issueUnarchive } = await gql(`mutation($id: String!) { issueUnarchive(id: $id) { success } }`, { id })
  console.log('unarchived:', issueUnarchive.success)
  await sleep(300)
  const { issueUpdate } = await gql(
    `mutation($id: String!, $title: String!, $stateId: String!) { issueUpdate(id: $id, input: { title: $title, stateId: $stateId }) { issue { identifier state { name } } } }`,
    { id, title, stateId: done.id }
  )
  console.log('updated:', issueUpdate.issue.identifier, '→', issueUpdate.issue.state.name)
  await sleep(300)
}
console.log('\nDone.')
