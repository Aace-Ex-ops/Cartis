// Marks the CARTIS-137 issue (image + voice) as Done. Idempotent by title.
// Usage: node scripts/linear-twin-profile-close.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "0b025df9-2525-42f7-b8eb-a1c62cfcc3eb";
const DONE_ID = "37f90851-23e9-4ab2-a065-a5313a9579db";
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const API = "https://api.linear.app/graphql";

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

const d = await gql(
  `{ issues(filter: { team: { id: { eq: "${TEAM_ID}" } }, title: { eq: "AI Twin: pro-gated image input (product purchases/inventory) + voice input" } }, first: 1) { nodes { id identifier state { name } } } }`,
);
const issue = d.issues.nodes[0];
if (!issue) throw new Error("issue not found");
if (issue.state.name === "Done") {
  console.log(`${issue.identifier} already Done`);
} else {
  await gql(`mutation { issueUpdate(id: "${issue.id}", input: { stateId: "${DONE_ID}" }) { issue { identifier state { name } } } }`);
  console.log(`${issue.identifier} -> Done`);
}