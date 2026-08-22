// Marks cluable backlogs done + comments (Aug 15). Reads API key from ~/.linear/api-key.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "0b025df9-2525-42f7-b8eb-a1c62cfcc3eb";
const STATES = { Done: "37f90851-23e9-4ab2-a065-a5313a9579db" };
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const API = "https://api.linear.app/graphql";

const actions = [
  {
    id: "CARTIS-71",
    comment:
      "Done Aug 15: stock tool shipped — /api/tools/stock (real yfinance via EC2) + Stocks tab on /dashboard/tools. Housing snapshot + real-transactions remain — see Kiro Phase 3 (CARTIS-72).",
  },
  {
    id: "CARTIS-81",
    comment: "Done Aug 15: epic complete — all children CARTIS-82..93 shipped (commit 1aea202 et al).",
  },
  { id: "CARTIS-94", comment: "Closed — test issue." },
  { id: "CARTIS-95", comment: "Closed — test issue." },
  {
    id: "CARTIS-122",
    comment: "Done Aug 15: switch-to-business/personal removed from account dropdown (commit 0323ab3).",
  },
  { id: "CARTIS-123", comment: "Marked done (owner decision)." },
  {
    id: "CARTIS-127",
    comment:
      "Done Aug 15: AI Twin capture shipped — twin-chat.tsx captures goal/holding/budget/profile/purchase/income with confirm cards -> DB.",
  },
  {
    id: "CARTIS-72",
    comment:
      'Aug 15: creds recovered — admin login token valid (201), clientId+secret OK. _TEST/_USER/_sandbox/_1..5 variants rejected Y305 (pre-registered only). YODLEE_TEST_LOGIN lives only in Yodlee dashboard "View Test Users" — hard blocker for AA data. Preview worker cartis-gateway-preview wired with Yodlee secrets/vars. InProgress.',
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

for (const a of actions) {
  const d = await gql(`query($id: String!) { issue(id: $id) { id state { name } } }`, { id: a.id });
  const issue = d.issue;
  if (!issue) {
    console.log(`!! ${a.id} not found`);
    continue;
  }
  if (a.id === "CARTIS-72") {
    await gql(`mutation { commentCreate(input: { issueId: "${issue.id}", body: ${JSON.stringify(a.comment)} }) { success } }`);
    console.log(`CARTIS-72: comment added (stays ${issue.state.name})`);
    continue;
  }
  if (issue.state.name !== "Done") {
    await gql(`mutation { issueUpdate(id: "${issue.id}", input: { stateId: "${STATES.Done}" }) { success } }`);
    console.log(`${a.id}: ${issue.state.name} -> Done`);
  } else {
    console.log(`${a.id}: already Done`);
  }
  await gql(`mutation { commentCreate(input: { issueId: "${issue.id}", body: ${JSON.stringify(a.comment)} }) { success } }`);
  console.log(`${a.id}: comment added`);
}