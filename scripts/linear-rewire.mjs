// Creates the "UI rewire" epic + child issues in Linear. Idempotent by title.
// Usage: node scripts/linear-rewire.mjs
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "0b025df9-2525-42f7-b8eb-a1c62cfcc3eb";
const STATES = {
  Backlog: "19936bd9-2908-4b68-a632-ebf29a99ae2d",
  Todo: "db93017c-43a6-4c27-afc0-da8fae37a9ec",
  InProgress: "1713baac-737a-44f4-a473-1e2866d56535",
  Done: "37f90851-23e9-4ab2-a065-a5313a9579db",
};
const KEY = readFileSync(join(homedir(), ".linear", "api-key"), "utf8").trim();
const API = "https://api.linear.app/graphql";

const EPIC = {
  title: "UI rewire — Revnue-style fintech design",
  state: "Backlog",
  description: `Rebuild the Cartis UI around the Revnue AI Finance ERP landing (jiro.build template) design language: ink #0C0C0C + white, Inclusive Sans / Gantari / Instrument Serif, rounded-full pill CTAs, alternating light/dark sections. Landing first (section-by-section, in order), then design system, auth/onboarding, app shell, dashboards.

Order per approved plan: replace landing → nav/hero → features/showcase/how-it-works → testimonials/pricing/faq/cta/footer → design system → auth+onboarding → app shell → consumer dashboards → seller dashboards → data components → verify+deploy.`,
};

const CHILDREN = [
  "Landing: replace page.tsx with Revnue-style section stack, keep auth wiring",
  "Landing: nav + hero (auth-wired, product mockup)",
  "Landing: partners/word-reveal + capabilities",
  "Landing: how-it-works + testimonials",
  "Landing: overview/CTA + FAQ + footer",
  "Design system: tokens + primitives restyle (button/card/input/table/tabs/…)",
  "Auth + onboarding restyle (signin/signup/onboarding-form/stepper)",
  "App shell restyle (sidebar/header/user-menu/twin)",
  "Consumer dashboards restyle (8 routes)",
  "Seller dashboards restyle (8 routes)",
  "Data components restyle (charts/tables/forms)",
  "Verify: npm run build + Cloudflare deploy",
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

async function findByTitle(title) {
  const d = await gql(
    `query($t: String!) { issues(filter: { team: { id: { eq: "${TEAM_ID}" } }, title: { eq: $t } }, first: 1) { nodes { id identifier } } }`,
    { t: title },
  );
  return d.issues.nodes[0] ?? null;
}

async function create(title, description, state) {
  const existing = await findByTitle(title);
  if (existing) {
    console.log(`skip ${existing.identifier} (exists)`);
    return { id: existing.id, identifier: existing.identifier };
  }
  const d = await gql(
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { id identifier } } }`,
    { input: { teamId: TEAM_ID, title, description: description ?? "", stateId: STATES[state] ?? STATES.Backlog } },
  );
  console.log(`created ${d.issueCreate.issue.identifier}`);
  return d.issueCreate.issue;
}

const epic = await create(EPIC.title, EPIC.description, EPIC.state);
for (const c of CHILDREN) {
  const child = await create(c, undefined, "Backlog");
  if (child.id !== epic.id) {
    await gql(
      `mutation { issueUpdate(id: "${child.id}", input: { parentId: "${epic.id}" }) { issue { identifier } } }`,
    );
    console.log(`parented ${child.identifier} -> ${epic.identifier}`);
  }
}
