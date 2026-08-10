// Creates "Design System Integration (21st.dev)" epic + child issues in Linear.
// Usage: node scripts/linear-design-system.mjs
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
  title: "Design System Integration — 21st.dev references",
  stateId: "19936bd9-2908-4b68-a632-ebf29a99ae2d",
  description: `Integrate 7 design references from 21st.dev into Cartis UI:

1. **Zen Linen remix** (theme) — @hajdeosk — warm linen palette, Inter/Playfair Display/JetBrains Mono
2. **Efferd Dashboard 2** — @sshahaider — dense KPI grid, revenue charts, invoices, activity feed
3. **Auth UI** — @easemize — social login, email/password, auth divider
4. **Multistep Form** — @arihantcodes — progress indicator, validation, Framer Motion transitions
5. **Ghost 404** — @xubohuah — animated ghost illustration
6. **Empty5** — @bundui — maintenance page with illustration
7. **ChatGPT Prompt Input** — @easemize — AI Twin spring-physics textarea, model selector, file attachments

Order: Theme → Dashboard Shell → Auth → Onboarding → Error/Empty States → AI Twin`,
};

const CHILDREN = [
  {
    title: "Theme: Zen Linen tokens + primitives restyle",
    description: `Replace globals.css tokens with Zen Linen palette (light + dark):
- Colors: --background #E9E4D8, --foreground #1E1E1E, --primary #2E2E2E, --card #F4EFE4, --border #D2CBBB
- Fonts: --font-sans Inter, --font-serif "Playfair Display", --font-mono "JetBrains Mono"
- Radius: 0.5rem, soft shadows (--shadow-opacity 0.1, --shadow-blur 10px)
- Update all 28 shadcn primitives (button, card, input, table, tabs, badge, dialog, dropdown, etc.)`,
    labels: ["theme", "design-system"],
  },
  {
    title: "Dashboard Shell: Efferd Dashboard 2 layout",
    description: `Replace DashboardShell with AppShell + Dashboard layout:
- KPI cards grid (revenue, channel sales, invoices, billing health)
- Chart sections using Recharts (area/bar/pie)
- Invoice table with status badges
- Activity feed sidebar
- Adapt for both consumer and seller roles (role-based content slots)
- Files: dashboard-shell.tsx, sidebar.tsx, header-bar.tsx, 16 dashboard pages`,
    labels: ["dashboard", "shell"],
  },
  {
    title: "Auth Pages: easemize Auth UI (signin/signup)",
    description: `Replace signin/page.tsx and signup/page.tsx with Auth UI:
- Social login buttons (Google, GitHub)
- Email/password form with validation
- AuthDivider component for "OR CONTINUE WITH EMAIL"
- Clean card layout on new theme background
- Decision: keep premium-auth warp or adopt clean card? (recommend clean card)`,
    labels: ["auth", "design-system"],
  },
  {
    title: "Onboarding: Multistep Form (arihantcodes)",
    description: `Replace onboarding-form.tsx + stepper.tsx:
- Progress indicator (completed/current/pending steps)
- Client-side validation with error messages
- Framer Motion for smooth step transitions (new dependency)
- Data review step before submission
- Success state with next steps
- Responsive, accessible, dark mode support`,
    labels: ["onboarding", "design-system"],
  },
  {
    title: "Error/Empty States: Ghost 404 + Maintenance + Access Restricted",
    description: `Three pages:
1. **404 page** (Ghost 404 by xubohuah) — animated ghost illustration
2. **/maintenance** (Empty5 by bundui) — scheduled maintenance message, illustration, refresh action
3. **/access-restricted** (v-empty-15 by cnippet.dev) — permission denied state
- Replace not-found.tsx, create new route pages`,
    labels: ["error-states", "design-system"],
  },
  {
    title: "AI Twin: ChatGPT Prompt Input (easemize)",
    description: `Replace TwinDrawer with spring-physics prompt input:
- Dynamic height scaling with spring physics (cubic-bezier)
- State-morphing typography
- Model selector dropdown
- File attachment support
- Keyboard shortcuts (Cmd+Enter to send, etc.)
- Keep existing AI backend integration (coach/advisor)`,
    labels: ["ai-twin", "design-system"],
  },
];

async function graphql(query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function issueExists(title) {
  const d = await graphql(
    `query($t: String!) { issues(filter: { team: { id: { eq: "${TEAM_ID}" } }, title: { eq: $t } }, first: 1) { nodes { id title } } }`,
    { t: title }
  );
  return d.issues.nodes[0] ?? null;
}

async function createIssue(input) {
  const d = await graphql(
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { id identifier } } }`,
    { input }
  );
  return d.issueCreate.issue;
}

async function createEpic(input) {
  const q = `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { id title } } }`;
  const res = await graphql(q, { input: { ...input, type: "Epic" } });
  return res.data?.issueCreate?.issue;
}

async function main() {
  console.log("Checking epic...");
  const epicId = await issueExists(EPIC.title);
  let epicRef;
  if (epicId) {
    console.log(`Epic exists: ${epicId}`);
    epicRef = epicId;
  } else {
    console.log("Creating epic...");
    const epic = await createIssue({ ...EPIC, teamId: TEAM_ID, stateId: STATES.Backlog });
    epicRef = epic.id;
    console.log(`Created epic: ${epicRef}`);
  }

  for (const child of CHILDREN) {
    const exists = await issueExists(child.title);
    if (exists) {
      console.log(`  Skip (exists): ${child.title}`);
      continue;
    }
    console.log(`  Creating: ${child.title}`);
    const created = await createIssue({
      title: child.title,
      description: child.description,
      teamId: TEAM_ID,
      stateId: STATES.Backlog,
    });
    // Parent to epic
    if (created.id !== epicRef) {
      await graphql(
        `mutation { issueUpdate(id: "${created.id}", input: { parentId: "${epicRef}" }) { issue { identifier } } }`
      );
      console.log(`  Parented to epic`);
    }
  }
  console.log("Done.");
}

main().catch(console.error);