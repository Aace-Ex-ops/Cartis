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

## Linear

- All auth issues done: CARTIS-24 (landing), CARTIS-25 (OAuth state),
  CARTIS-26 (UI session layer), CARTIS-27 (extension + proxy),
  CARTIS-28 (email/password auth).
- Team `0b025df9-2525-42f7-b8eb-a1c62cfcc3eb`; Done state
  `37f90851-23e9-4ab2-a065-a5313a9579db`.
