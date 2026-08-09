# Cartis — Notes

## Auth: the browser-vs-curl mystery (solved 2026-08-01)

### Symptom
Google sign-in never reached accounts.google.com. Address bar stayed at
`…/auth/login?provider=google`, page showed the landing page — even in Brave
incognito. `curl` worked fine (302 → Google), only real browsers failed.

### Root cause
Cloudflare Workers Assets with `not_found_handling: "single-page-application"`
and `compatibility_date >= 2025-04-01` enables
`assets_navigation_prefers_asset_serving`: for **navigation requests**
(`Sec-Fetch-Mode: navigate`, what every browser tab click sends), the platform
serves the SPA fallback (`/index.html`) **without ever invoking the Worker**.
So `/auth/login`, `/login`, `/auth/start` all returned the landing page to
browsers, while curl (no navigation headers) hit the Worker and got the 302.

Not a cache issue (cache headers were already `no-store`/`max-age=0`); the
"poisoned cache" observations were the platform serving the fallback from its
own cache at distinct paths.

### Fix
`run_worker_first` in `gateway/wrangler.jsonc` — the Worker owns these paths,
navigation or not:

```jsonc
"assets": {
  "directory": "../ui/out",
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/auth/*", "/api/*", "/graphql", "/webhooks/*", "/health", "/login"]
}
```

Everything else stays asset-first (SPA pages like `/signin`, `/dashboard`).

### How to verify
With navigation headers, `/auth/start` must 302 to accounts.google.com:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  https://cartis-gateway.rz8m4crnwt.workers.dev/auth/start \
  -H 'sec-fetch-site: same-origin' -H 'sec-fetch-mode: navigate' -H 'sec-fetch-dest: document'
```

### Dead ends (do not revisit)
- `Vary: sec-fetch-site, sec-fetch-mode, sec-fetch-dest` — cache-key splitting
  didn't help; cache was never the issue. Removed.
- `/_purge` route (Cache API delete over a URL×variant matrix, `deleted: 0`) —
  platform fallback entries can't be evicted via the Cache API. Removed.

## Auth: architecture (current)

- **Login flow**: `/login` → 302 `/auth/start?provider=google` → 302
  accounts.google.com → callback `/auth/callback` → token exchange →
  `userinfo` → `upsertGoogleUser` (DB, ON CONFLICT email DO UPDATE, shared
  identity with password logins) → KV session (`session:<token>` +
  `user_sessions:<id>`, 7-day TTL, 10-min rotation) → redirect `/dashboard`.
- **OAuth state**: HMAC-signed `id.provider.exp.sig` (no KV — kills the old
  KV read-after-write race), 10s TTL.
- **Sessions**: `Session` = session_id/user_id/email/name/avatar/
  provider/exp/last_rotation. Cookie + Bearer both work (`/auth/me`,
  GraphQL proxy).
- **Password auth**: argon2 (`PasswordHasher`/`PasswordVerifier` +
  `SaltString::generate(&mut OsRng)`), gateway `/auth/signup` + `/auth/login`,
  duplicate signup → 409.
- **Google OAuth client**: `102580553542-i10eokpgo7nbs636ds9c1ltavrcbc431.apps.googleusercontent.com`,
  redirect `https://cartis-gateway.rz8m4crnwt.workers.dev/auth/callback`.
  In **Testing mode** — new Google accounts must be added as Test users in
  Google Cloud Console, or Google blocks the consent screen.

## Infra quickies

- Backend deploy (EC2): `su - ubuntu -c "cd /home/ubuntu/api && PATH=/home/ubuntu/.cargo/bin:$PATH cargo build --release"` → stop → `cp target/release/cartis-api /home/ubuntu/api/cartis-api` → start (binary busy otherwise). Upload changed src via SSM: gzip → base64 (fits the 97KB send-command limit; raw base64 of 81KB graphql.rs does not).
- Backend HTTPS: nginx 443 vhost `40.192.51.1.sslip.io` (Let's Encrypt via `certbot certonly --standalone` with brief nginx stop; certbot installs under `/etc/letsencrypt/live/40.192.51.1.sslip.io/`). SG must allow 443 — opened `sg-026bedd566b638501` for 0.0.0.0/0.
- Gateway secret puts need `printf %s | npx wrangler secret put NAME --name cartis-gateway` (wrangler 4.x; `--stdin`/`--value` flags error). Deploy after every secret change.
- Wrangler OAuth token `~/.wrangler/config/default.toml` expires ~hourly —
  `npx wrangler whoami` to refresh before v4 API calls.
- KV namespace `540329106cb74e56a5a2c659ccb98b49` (SESSIONS),
  account `10112875ad4b991b430e4a8ed79124a7`; keys are URL-encoded
  (colon → `session%3A…`).

## Gateway↔backend connectivity — fixed Aug 8

Root cause of the signup 403: Cloudflare Workers **block outbound `fetch()` to bare-IP HTTP origins** (edge returns HTTP 403, body `error code: 1003`, before hitting nginx — nginx/backend were never involved). Fix chain:

1. Let's Encrypt cert for `40.192.51.1.sslip.io` (certbot standalone, brief nginx stop) + nginx 443 vhost proxying to 127.0.0.1:8000 + SG rule for 443.
2. Gateway `BACKEND_URL=https://40.192.51.1.sslip.io` (secret put + deploy), `BACKEND_SECRET` matched both sides (`FINAL-MATCH-TOKEN`).
3. DB grants: `cartis` role lacked privileges on newer tables → `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public TO cartis`.
4. `userActions` still failed: `ensure_suggested_actions`'s parameterized `INSERT ... WHERE NOT EXISTS` hit PG error 42P18 ("inconsistent types deduced for parameter $2: text versus character varying") — `a.kind = $2` vs target column `kind varchar(30)`. Fix in api/src/graphql.rs: `$2::varchar` in the subquery (keep `$1::text::uuid` so tokio_postgres can serialize `&str`). Same pattern elsewhere is single-use-param, safe.

Verified end-to-end: gateway signup/login → Set-Cookie session → `/graphql` proxy (forwards `x-user-id` from session) → backend → postgres. Gateway signup now returns `{"ok":true}` + dashboard queries resolve.

## Advisor: executive summary + saved business type + Pro checkout (Aug 8)

Gap-closing round on the seller advisor (per user decisions: keep ledger-derived KPIs, add LLM exec summary, persist business type, wire Pro checkout):

- **DB**: `users.business_type VARCHAR(20) NOT NULL DEFAULT 'saas' CHECK (business_type IN ('saas','d2c','services','retail'))` — live ALTER + mirrored in `scripts/schema.sql`.
- **Backend** (api/src/graphql.rs): `User.business_type` field (struct + `from_row` `r.get(20)`, `businessType()` getter), added to `me` SELECT + 3 `RETURNING` lists; `updateUserType` now takes `businessType: Option<String>` → `SET business_type = COALESCE($4, business_type)`. Rebuilt + deployed on instance (md5 of uploaded src `af36b97e87303874651f866ac43174d0`).
- **Gateway** (src/index.ts): `savedBusinessType(c, userId)` — queries `me { businessType }` via backendGql, falls back `'saas'`; both `/api/advisor/health` + `/api/advisor/strategies` use saved type when body omits `businessType`; strategies prompt asks LLM for `executiveSummary`; deterministic `execSummary(health)` fallback (3 score branches + `no_data`), always present in response; `advisorFallback` includes it too.
- **UI** (ui/src/app/seller/coach/page.tsx): Executive Summary card at top of report; business-type chips load saved value via `gql('query { me { businessType } }')` and persist via `updateUserType` mutation (aliases needed for repeated same-named mutation fields); non-Pro Export button replaced with "Upgrade to Pro" → POST `/api/subscription/checkout {productId: 55681814-5a2b-4312-94c0-6fef945fc0ed}` (Cartis Monthly, $5/mo) → redirect to Polar checkout URL. Pattern from `ui/src/components/consumer/subscription-panel.tsx` (`PLANS` holds the other product ids: Annual `8ec4fb7d-…` $48/yr, One-Time `596f42f7-…` $25).
- **Verified**: updateUserType persists → `me.businessType` round-trips; health/strategies pick up saved `d2c` with no body arg (D2C benchmarks applied); strategies returns `executiveSummary` (LLM JSON when parse succeeds, deterministic fallback otherwise — `fallback: true` flags it); checkout POST returns a sandbox Polar URL; entitlement GET works (earlier 401s were just stale rotated session cookies).
- Session cookie rotates on auth'd requests — re-login (`/auth/login`) before re-testing long-lived curl sessions.

## Setu AA integration (2026-08-05 → 07)

### Done

- **Setu proxy (EC2)** — Setu APIs are reachable only from Indian IPs;
  Cloudflare Workers egress is not → 403. Fix: `/setu-proxy` route on the
  EC2 backend (ap-south-1), generic HTTP passthrough gated by
  `x-cartis-backend-secret`. **Aug 8: the route moved INTO the local repo**
  (`api/src/main.rs` — was previously server-only in `/home/ubuntu/api-src/`,
  an orphaned tree that isn't what cartis-api builds from; the deployed
  binary silently lost `/setu-proxy`, so Setu routes + anything proxy-based
  were 404ing until the route was ported to the repo and redeployed).
  Gateway `setuProxy`/`getSetuToken`/`setuFetch` route all proxied traffic
  through `{BACKEND_URL}/setu-proxy`.
- **AA routes (gateway)** — `/api/aa/consent`, `/api/aa/status/:consentId`,
  `/api/aa/fetch`, `/api/aa/reconnect` (commit `b44676f`).
- **Consent payload fixes** — `frequency.value`/`dataLife.value` must be
  numbers (string `'1'` → "Cannot have frequency greater than 1 if
  fetchType is ONETIME"); `frequency.unit` is `MONTH` (real enum
  HOUR/DAY/MONTH/YEAR/INF — docs' `MONTHLY` is wrong); purpose text
  "Customer spending patterns, budget or other reportings" (commit
  `05aeba7`, deployed `1588641f`).
- **Setu webhook** — `/webhooks/setu` + `/v1/consents/notify` +
  `/v1/fi/notify` (Sahamati-standard paths); no signature (Setu sends
  none). Stores CONSENT_STATUS_UPDATE / SESSION_STATUS_UPDATE events in
  KV (`setu:consent:<id>`, `setu:session:<id>`); `/api/aa/status` reads
  the cache before polling Setu (commit `ea6465e`, deployed `bab19f25`).
- **Credentials** — swapped through 3 products; `.dev.vars` + Cloudflare
  secrets (`wrangler secret put`, then redeploy — secrets don't apply
  until the next deploy). Current: product `0ecc45d8-63c7-4c1b-8b47-116819ea82f2`,
  client `1b4186fa-67c5-41d5-8e6e-e6967453a5e1`, secret `sAhzlgtW0AqaR8PifZ0vhO0lkblJNCw5`
  (deployed `b3d0b42b`).
- **UI** — aa-connect flow (PR #5, `50b2df8`): consent URL redirect,
  status polling, fetch-on-ACTIVE.
- **Webhook registered on Bridge** by user (notification endpoint =
  `https://cartis-gateway.rz8m4crnwt.workers.dev/webhooks/setu`).

### Blocked: consent creation 500s

`POST https://fiu-sandbox.setu.co/v2/consents` always returns
`InternalServerError` — "ConsentObjectCreationFailure: internal error
while fetching consent details from upstream AA". Proved Setu-side:

- 3 different products on the same FIU, identical failure
- Every payload variant: all fetchTypes, fiTypes, VUA formats
  (`9876543210`, `@onemoney`, `@setu`, `@finvu`, `@anumati`), redirectUrls,
  and Setu's docs minimal example body verbatim
- Auth works, account-availability works (mobile `9876543210` registered
  on all 4 sandbox AAs), FIP list works — only consent creation fails
- Webhook registered, still 500

TraceIds: `1-6a757f0c-5cb1e5bf345f47a948dec5eb`,
`1-6a757d2c-304300ab27f18dda0aa2cf3c`, `1-6a757c5c-3534e6763f7d30d67e90b42c`,
`1-6a756612-3e797ef8218d056963e5b48b`.

Remaining variables: **Bridge KYC not done by user** (docs say sandbox
shouldn't need it, but it's the cheapest untested variable); support
email to support@setu.co pending. Production additionally requires
Sahamati FIU certification + a regulated-entity license — AA may be
sandbox-only for us. Alternative AA providers (Finvu/OneMoney/Anumati
sandboxes) use the same Sahamati spec — payload/code ~90% portable.

### Extension price "alternatives" are fake

`coach.ts` step 4 asks the LLM to invent `alternatives` prices — they're
hallucinated, not real. `price_index:<gtin>` KV is never written by
anything. Real aggregators (MySmartPrice, Smartprix, CamelCamel,
PriceHistory India API) 403 foreign + datacenter IPs — same wall as Setu.
Candidates (locked: Exa AI, awaiting key): Exa AI search (works from
Cloudflare IPs, needs `EXA_API_KEY`), PriceHistory India API (free key, IP
tolerance unverified), or own price history from our own traffic (free,
cold start).

### Infra notes

- SSH to EC2 now works on **port 2222** (`ssh -p 2222 -i ~/.ssh/cartis-ec2.pem ubuntu@<ip>`) — sshd moved off 22 (SG still shows 22/0.0.0.0 open, but connection refused). Instance IP is ephemeral and has changed (18.60.39.208 → 40.192.51.1): get current IP via `aws ec2 describe-instances --region ap-south-2 --instance-ids i-04cd1166eb0544344` or SSM. SSM `aws ssm send-command` also works for mgmt.
- Backend deploy (Aug 9): scp `src/*.rs` + Cargo.toml/lock to `/home/ubuntu/api/` → `cargo build --release` (PATH needs `$HOME/.cargo/bin`) → `systemctl restart cartis-api`. Deployed: insights role normalization, email via gateway.
- CARTIS-105 shipped: `normalize_role` at coach_insights query/refresh/save entry (GraphQL resolvers passed raw `personal`/`business` into a `CHECK role IN ('consumer','seller')` column). Deployed; constraint errors gone.
- CARTIS-104 shipped (email): backend `send_email` → gateway `POST /api/email` (x-cartis-backend-secret) → Resend with the worker's valid key. Instance `.env` RESEND/MAILJET keys are dead — unused now. `EMAIL_FROM` var on gateway (default `Cartis <onboarding@resend.dev>`). Verified live: 200 to key owner `dsjzcjmsh6@privaterelay.appleid.com`; 403 to other recipients until a domain is **verified in Resend** (user action) — then set `EMAIL_FROM=Cartis <no-reply@...verified-domain>`.
- Setu token cached in KV 25 min (`setu:token`, TTL 1500s).

## Linear

- All auth issues done: CARTIS-24 (landing), CARTIS-25 (OAuth state),
  CARTIS-26 (UI session layer), CARTIS-27 (extension + proxy),
  CARTIS-28 (email/password auth).
- Team `0b025df9-2525-42f7-b8eb-a1c62cfcc3eb`; Done state
  `37f90851-23e9-4ab2-a065-a5313a9579db`.

## Phase 1: Kiro tools — shipped (Aug 7, post-Setu-pivot)
- Chat tool modes: `ChatRequest.tool` (tax|retirement|budget|stock), persisted in new `chat_sessions.tool` column (in schema.sql, pending DB apply), tool-specialist system prompts in chat.rs `TOOLS`/`tool_system()`. Backend compiles; deploy blocked on SSH (CARTIS-74).
- Gateway tools live (deploy eca5cfa0): POST /api/tools/retirement (12%/6% assumptions, 4% SWR, corpus/SIP solver), POST /api/tools/tax (FY26-27 new-vs-old, 80C/80D/HRA, 87A rebate ≤₹12L), GET /api/tools/stock.
- **Stock lookup (Aug 8, Twelve Data dropped)**: EC2 Python service `apps/stock-service/` (FastAPI + `yfinance`, systemd `cartis-stock.service`, uvicorn on 127.0.0.1:8001, localhost-only) → **Redis cache** `stock:<sym>` TTL 300 (Redis was already running on the EC2). Gateway `/api/tools/stock` routes through the existing `setuProxy` helper → nginx 443 → `/setu-proxy` → Python. Symbol normalization in Python: `.NSE`→`.NS`, `.BSE`→`.BO`, bare → as-is then `.NS` retry. Response shape matches the UI `Stock` type (symbol/name/close/previous_close/change/percent_change) — no UI changes. No API keys anywhere (Twelve Data free tier is US-only anyway; Grow $29/mo would unlock India but yfinance is free). Gleam WebSocket streaming (`pipeline/pricescan.gleam` + `broadcast.gleam` scaffolds) deferred — Redis pub/sub path is clear when needed.
- UI: tool chip switcher in twin-chat (consumer only), ships with out/ on deploy. Commits e05cbb1, e2f0d59.

## Goals/portfolio/tools/actions UI — shipped Aug 7 (43ebbdb, deploy 3fd3254c)
- Pages: /dashboard/goals (CRUD goals, ±₹1k/10k quick-bump, progress bars), /dashboard/portfolio (add/delete/update-price holdings, allocation bars, invested/current/returns header), /dashboard/tools (tabs retirement/tax/stock hitting /api/tools/*, supports ?tab= for action CTAs).
- Dashboard action cards: userActions query (already in graphql.rs w/ rule-based ensure_suggested_actions) rendered with Done/Dismiss via setUserActionStatus mutation; cards auto-hide on resolve.
- Nav: consumer sidebar gains Goals/Portfolio/Tools.
- `holdings` query + `portfolio` summary committed in same commit (14 lines graphql.rs).
- Gotcha: static export has no SPA fallback (not_found_handling: none) — hit /dashboard/goals/ trailing-slash URLs; fresh deploys may 404 once on CDN edge cache, resolves.
- Backend GraphQL for these was already merged; the queries 404 over the gateway proxy until backend deploy lands (CARTIS-74).

## Advisor (CARTIS-75..80) — shipped Aug 7
- /api/advisor/health (76): KPIs from seller_finances(limit 5000) filtered client-side by month (revenue/cogs/opex/cash/GM/NM), static benchmarks saas/d2c/services/retail, rule-based 0-100 score (GM 30 / NM 30 / cash 20 / momentum 10 / cost 10), leak flags (COGS pressure, top-2 opex cats), KV 1h.
- /api/advisor/strategies (77): rule-seeded llama-4-scout prompt → JSON; model is flaky (broken JSON / empty sections ~2/3) → deterministic advisorFallback() (article's 3 allocation branches + 4 risk templates) serves when parse fails or sections empty; KV 1h, refresh=1.
- /api/advisor/entitlement + Polar webhook → polar:entitled:<userId> KV 1y on paid events (80); checkout already sends metadata.user_id.
- UI: /seller/coach = Financial Advisor (78): score gauge, benchmark bars with healthy band, leak callouts, 3 tactic cards, capital allocation, severity-badged risks, business-type chips (saas/d2c/services/retail), Export PDF Pro-gated (79) via window.print() + @page A4 in globals.css. Commits d77a634, 9486fda; deploys 63014ada (UI+gw).
- TODO: PDF button needs real Polar productId checkout link when Pro is configured; entitlement currently only grantable via a real paid Polar event.

## CARTIS-73: real price alternatives — shipped Aug 7 (ea73ea4, deploy 09e18cc7)
- step4 schema no longer includes alternatives; verdict.alternatives assigned from code: Exa AI search (query 1 = GTIN keyword, fallback 2 = `"{name}" price`, max 2 calls, 24h KV cache `exa:<gtin>`, price regex `₹|INR|Rs`, site = result hostname) → own `price_index:<gtin>` (different-site record) → [].
- recordObservation: every /api/coach/analyze upserts price_index:<gtin> (same-day cheaper wins, 1y TTL).
- Pending: `wrangler secret put EXA_API_KEY` (replaces SerpAPI — no key set; without it alternatives stay []).

## CARTIS-72: bank linking via Yodlee — shipped Aug 9 (Setu AA replaced)
- Setu sandbox /v2/consents was an upstream 500 (CARTIS-63, canceled). Pivoted to **Yodlee (Envestnet)**: client-credentials auth (POST /auth/token, clientId+secret+loginName → 30-min bearer), hosted **FastLink** link UI, free sandbox at `https://sandbox.api.yodlee.com/ysl` (5 preconfigured test users, sample data; Test User 1 = `sbMem6a78947d1ea541`).
- Gateway: `yodleeToken` (KV `yodlee:token:<login>` TTL 1500), `yodleeFetch` (Bearer + Api-Version: 1.1), `parseYodleeFetch`, `syncYodleeData`. Routes: `GET /aa/link` (server-side-minted FastLink page, callback via `?cb=`), `POST /aa/success` (FastLink onSuccess → KV `yodlee:linked`), `/api/aa/consent` (returns `linkUrl`), `/api/aa/status/:x` (linked? → `/accounts`), `/api/aa/fetch` + `/reconnect` (accounts+transactions → `syncAaData`, aaHandle/consentId = 'yodlee'). Setu AA helpers + webhooks removed; `setuProxy` kept for the stock tool. Direct fetch from Workers — no EC2 proxy hop.
- UI `aa-connect.tsx`: no more mobile number — one "Connect your bank account" button → /aa/link webview → FastLink → callback `?linked=1` → poll status → fetch. `AaReconnect` unchanged.
- Secrets: `YODLEE_CLIENT_ID/SECRET/ADMIN_LOGIN/TEST_LOGIN`; vars `YODLEE_BASE_URL`, `YODLEE_FASTLINK_URL=https://fl4.sandbox.yodlee.com/authenticate/restserver/fastlink`. Deploy b27e833c → 10dad121 (Exa) → 3ad5d55b (email proxy) → fc946bd1 (clean).
- E2E verified live: status → 3 Dag Site accounts (xxxx8614/$1636.44, xxxx3xxx/$9044.78, xxxx3xxx/$44.78); fetch → synced ok, transactions 0 (sandbox has no txns until Account Simulator or a fresh FastLink link).
- Sandbox gotchas: **KV keys written via wrangler CLI are NOT immediately visible to the worker** (API-write propagation) — for E2E tests, write sessions through a worker endpoint instead; FastLink config must be published in the dashboard with the gateway + UI domains whitelisted (user action, pending); test creds for linking: Dag Site `YodTest.site16441.2`/`site16441.2` (MFA: `YodTest.site16442.1`/`site16442.1` OTP 123456); production = Engage tier (real users via POST /user/register, real Indian FIs, licensing).
