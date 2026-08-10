// Marks shipped landing rewire issues Done + comments (idempotent-ish).
// Usage: node scripts/linear-sync-rewire.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STATES = { Done: "37f90851-23e9-4ab2-a065-a5313a9579db" };
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const API = "https://api.linear.app/graphql";

const actions = [
  { id: "CARTIS-82", comment: "Done Aug 8: page.tsx replaced with Revnue-style section stack (nav, hero, partners, capabilities, how-it-works, testimonials, overview, faq, footer), auth wired via AuthAwareLink + /signin /signup. Old Warp landing components kept in repo, unused." },
  { id: "CARTIS-83", comment: "Done Aug 8: RevnueNav (sticky pill nav, Login→/signin, Sign up→/signup, mobile drawer) + RevnueHero (Inclusive Sans headline, floating dashboard mockup, auth-aware CTA)." },
  { id: "CARTIS-84", comment: "Done Aug 8: RevnuePartners (logo marquee + scroll word-reveal) + RevnueCapabilities (Finance made smarter, 3 glass cards)." },
  { id: "CARTIS-85", comment: "Done Aug 8: RevnueHowItWorks (auto-rotating 4-step w/ progress bar) + RevnueTestimonials (crossfade quote card, prev/next)." },
  { id: "CARTIS-86", comment: "Done Aug 8: RevnueOverview (masked line reveal) + RevnueFaq (6-item accordion) + RevnueFooter (gradient headline, dark rounded footer card, giant wordmark)." },
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
  if (issue.state.name !== "Done") {
    await gql(`mutation { issueUpdate(id: "${issue.id}", input: { stateId: "${STATES.Done}" }) { success } }`);
    console.log(`${a.id}: ${issue.state.name} -> Done`);
  } else {
    console.log(`${a.id}: already Done`);
  }
  await gql(`mutation { commentCreate(input: { issueId: "${issue.id}", body: ${JSON.stringify(a.comment)} }) { success } }`);
  console.log(`${a.id}: comment added`);
}
