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

- Backend deploy (EC2): stop → `cp /home/ubuntu/api/build/target/release/cartis-api
  /home/ubuntu/api/cartis-api` → start (binary busy otherwise).
- curl from Mac can't reach EC2:443 (security group = Cloudflare IPs only);
  test through the gateway.
- Wrangler OAuth token `~/.wrangler/config/default.toml` expires ~hourly —
  `npx wrangler whoami` to refresh before v4 API calls.
- KV namespace `540329106cb74e56a5a2c659ccb98b49` (SESSIONS),
  account `10112875ad4b991b430e4a8ed79124a7`; keys are URL-encoded
  (colon → `session%3A…`).

## Setu AA integration (2026-08-05 → 07)

### Done

- **Setu proxy (EC2)** — Setu APIs are reachable only from Indian IPs;
  Cloudflare Workers egress is not → 403. Fix: `/setu-proxy` route on the
  EC2 backend (ap-south-1), generic passthrough gated by
  `x-cartis-backend-secret`. Lives **only on the server**
  (`/home/ubuntu/api-src/src/main.rs`, NOT in the local `api/` repo).
  Gateway `setuProxy`/`getSetuToken`/`setuFetch` route all Setu traffic
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
Candidate paths (undecided): SerpAPI Google Shopping (paid, works from
any IP), PriceHistory India API (free key, IP tolerance unverified), or
own price history from our own traffic (free, cold start).

### Infra notes

- SSH to EC2 (`18.60.39.208`) now times out from Mac — was reachable
  earlier this session; security group may have changed. Deploy path
  otherwise: scp main.rs → `cargo build --release` → stop/`cp`/start
  systemd unit `cartis-api`.
- Setu token cached in KV 25 min (`setu:token`, TTL 1500s).

## Linear

- All auth issues done: CARTIS-24 (landing), CARTIS-25 (OAuth state),
  CARTIS-26 (UI session layer), CARTIS-27 (extension + proxy),
  CARTIS-28 (email/password auth).
- Team `0b025df9-2525-42f7-b8eb-a1c62cfcc3eb`; Done state
  `37f90851-23e9-4ab2-a065-a5313a9579db`.
