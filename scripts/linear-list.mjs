import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "0b025df9-2525-42f7-b8eb-a1c62cfcc3eb";
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const res = await fetch("https://api.linear.app/graphql", {
  method: "POST",
  headers: { Authorization: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `query { issues(filter: { team: { id: { eq: "${TEAM_ID}" } } }, first: 100) {
      nodes { identifier title state { name } updatedAt }
    } }`,
  }),
});
const j = await res.json();
if (j.errors) throw new Error(JSON.stringify(j.errors));
const rows = j.data.issues.nodes
  .map((i) => `${i.identifier}\t${i.state.name}\t${i.title}`)
  .sort();
console.log(rows.join("\n"));
