# Cartis — System Architecture

## Overview

AI-powered multi-category e-commerce & fintech platform with quad-choice payment gateway and AI financial health engine.

---

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js + Apollo Client | UI + GraphQL client |
| Edge | Cloudflare Workers | GraphQL gateway + auth |
| Edge Cache | Cloudflare KV | Profile + session + IP |
| Backend | Rust + Axum + async-graphql | Compute-heavy API |
| Real-time | Gleam + WebSocket | Live data via Redis |
| AI/ML | Python (cron jobs) | Models + inference |
| Database | PostgreSQL (AWS RDS) | Source of truth |
| Cache | Redis (EC2) | Full user state + cache |
| Queue | Redis Streams | Inter-service messaging |
| Payments | Polar.sh | All payment processing |
| Auth | OAuth2 (Google, Apple, Outlook) | Login/signup only |
| Monorepo | Turborepo | Workspace management |
| CI/CD | GitHub Actions | Build + deploy |
| Task tracking | Linear | Issues + sprints |
| Git | Git Flow | Branching strategy |

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                                │
│                                                                  │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │ Pages         │    │ Workers (GraphQL Gateway + Auth)      │   │
│  │ Next.js       │    │                                      │   │
│  │ Apollo Client │───▶│ 1. Validate session token            │   │
│  └──────────────┘    │ 2. OAuth2 (Google, Apple, Outlook)    │   │
│                       │ 3. Route GraphQL → Rust backend       │   │
│  Browser stores:      │                                      │   │
│  ONLY: sha256(        │ KV: profile + session + IP           │   │
│   session_id + exp)   └──────────────┬───────────────────────┘   │
│  in HttpOnly Secure Cookie           │                           │
└──────────────────────────────────────┼───────────────────────────┘
                                       │ GraphQL (HTTPS)
┌──────────────────────────────────────┼───────────────────────────┐
│                        AWS EC2       ▼                            │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ Rust (Axum + async-graphql)                               │   │
│  │                                                           │   │
│  │ Products │ Cart │ Checkout │ Ledger │ Wallet │ Tab        │   │
│  │ Search   │      │ Quad-    │Double- │        │ Annual     │   │
│  │          │      │ Choice   │ Entry  │        │ Deferred   │   │
│  └────────────────────┬──────────────────────────────────────┘   │
│                       │ gRPC (1:1)                                │
│  ┌────────────────────┴──────┐  ┌────────────────────────────┐   │
│  │ Gleam (Real-time)         │  │ Python (AI/ML Cron)        │   │
│  │ WebSocket via Redis       │  │ Financial health score     │   │
│  │ Live inventory            │  │ Spend velocity             │   │
│  │ Order status streaming    │  │ Cost swaps                 │   │
│  │ Budget alert push         │  │ Recommendations            │   │
│  └───────────────────────────┘  │ Saves → PostgreSQL         │   │
│                                  └────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
┌─────────────────────┐  ┌─────────────────────┐
│ AWS RDS (PostgreSQL)│  │ Redis (EC2)          │
│ Source of truth     │  │ Full user state      │
│                     │  │ Cache (cache-aside)  │
│ users, products,    │  │ Live inventory       │
│ transactions,       │  │ Redis Streams (mq)   │
│ ledgers, AI scores  │  │                      │
└─────────────────────┘  └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ Polar.sh            │
│ All payment flows   │
└─────────────────────┘
```

---

## Data Flow

### Cache-Aside Pattern

**Read path:**
```
Browser → CF Workers (GraphQL GW) → CF KV → Redis → RDS
                                      ↓       ↓       ↓
                                   hit → return
                                   miss → check next
```

**Write path:**
```
CF Workers → Rust API → RDS (write) → Redis (update) → CF KV (if semi-static)
```

### User Data

| Store | Data | Consistency |
|-------|------|-------------|
| CF KV | Profile + session + IP | Eventual (semi-static, OK) |
| Redis | Full user state, cart, real-time activity | Consistent |
| RDS | Permanent record, source of truth | Strong |

---

## Auth Flow

```
1. Browser → "Sign in with Google"
2. CF Workers → OAuth2 redirect to Google
3. Google callback → CF Workers validates token
4. CF Workers:
   a. Create/find user in Redis → RDS
   b. Generate random session_id
   c. Compute token = sha256(session_id + expiration)
   d. Store in CF KV: { token → { session_id, user_id, profile, ip, exp } }
   e. Store in Redis: { session_id → full_user_state }
5. Browser receives: Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
6. All requests: cookie sent automatically
7. CF Workers: token → KV lookup → user context → forward to Rust
```

**No localStorage. Cookie is HttpOnly (JS can't read it). SHA256 is the token value itself.**

---

## GraphQL Schema

```graphql
type Query {
  # Products
  products(filter: ProductFilter, limit: Int, offset: Int): [Product!]!
  product(id: ID!): Product
  categories: [Category!]!
  search(query: String!): [Product!]!

  # Cart
  cart: Cart

  # User
  me: User
  wallet: Wallet
  monthlyTab: MonthlyTab
  annualDeferred: AnnualDeferred

  # Orders
  orders(limit: Int, offset: Int): [Order!]!
  order(id: ID!): Order

  # AI
  financialHealthScore: FinancialHealthScore
  spendVelocity: SpendVelocity
  affordabilityCheck(productId: ID!): AffordabilityResult
  recommendations: [Product!]!

  # Seller
  sellerDashboard: SellerDashboard
}

type Mutation {
  # Cart
  addToCart(productId: ID!, quantity: Int!, variantId: ID): Cart!
  updateCartItem(itemId: ID!, quantity: Int!): Cart!
  removeFromCart(itemId: ID!): Cart!

  # Checkout
  checkout(paymentMethod: PaymentMethod!): Order!
  fundWallet(amount: Float!): Wallet!
  setMonthlyTabLimit(limit: Float!): MonthlyTab!

  # Orders
  cancelOrder(id: ID!): Order!
  requestReturn(orderId: ID!, reason: String!): Return!

  # User
  updateProfile(input: UpdateProfileInput!): User!
}

type Subscription {
  orderStatus(orderId: ID!): OrderStatusUpdate!
  inventoryAlert(productId: ID!): InventoryUpdate!
  budgetAlert: BudgetAlert!
}
```

---

## Monorepo Structure

```
cartis/
├── .env.example                # Committed. Empty placeholders.
├── .gitignore
├── turbo.json
├── package.json
│
├── apps/
│   ├── web/                    # Next.js + Apollo Client → CF Pages
│   │   ├── .env.example        # Subset: CF gateway URL, app config
│   │   ├── app/                # App Router
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── apollo-client.ts
│   │   │   └── graphql/
│   │   │       └── generated/  # codegen output
│   │   └── graphql/
│   │       └── schema.graphql  # Frontend schema copy
│   │
│   ├── gateway/                # CF Workers → GraphQL gateway + auth
│   │   ├── .env.example        # OAuth creds, KV IDs, Redis URL
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── auth.ts         # OAuth2 handlers
│   │   │   ├── session.ts      # SHA256 token → KV lookup
│   │   │   └── router.ts       # Forward to Rust
│   │   └── wrangler.toml
│   │
│   ├── api/                    # Rust Axum + async-graphql
│   │   ├── .env.example        # DATABASE_URL, REDIS_URL, Polar.sh
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── graphql/        # Schema + resolvers
│   │   │   ├── handlers/       # Business logic
│   │   │   ├── db/             # sqlx queries
│   │   │   ├── models/
│   │   │   └── ledger/         # Double-entry engine
│   │   └── Cargo.toml
│   │
│   ├── realtime/               # Gleam WebSocket
│   │   ├── .env.example        # REDIS_URL, RUST_API_URL
│   │   ├── src/
│   │   │   ├── main.gleam
│   │   │   ├── websocket.gleam
│   │   │   └── redis_reader.gleam
│   │   └── gleam.toml
│   │
│   └── ai/                     # Python cron jobs
│       ├── .env.example        # DATABASE_URL, REDIS_URL
│       ├── src/
│       │   ├── health_score.py
│       │   ├── spend_velocity.py
│       │   ├── cost_swaps.py
│       │   ├── recommendations.py
│       │   └── db.py
│       ├── pyproject.toml
│       └── cron_schedule.yaml
│
├── packages/
│   ├── shared/                 # TypeScript types (shared web + gateway)
│   │   └── src/
│   │       ├── types.ts
│   │       └── constants.ts
│   └── proto/                  # gRPC service definitions
│       └── service.proto
│
├── infra/
│   ├── docker-compose.yml
│   ├── deploy/
│   │   ├── cloudflare/
│   │   └── aws/
│   └── migrations/
│       └── 001_init.sql
│
└── plan.md
```

---

## Database Schema (PostgreSQL on RDS)

```sql
-- Users
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    oauth_provider VARCHAR(20) NOT NULL CHECK (oauth_provider IN ('google', 'apple', 'outlook')),
    wallet_balance NUMERIC(12,2) DEFAULT 0.00,
    monthly_tab_limit NUMERIC(12,2) DEFAULT 600.00,
    annual_deferred_limit NUMERIC(12,2) DEFAULT 2500.00,
    financial_health_score INT DEFAULT 750,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (reference only — primary store is CF KV + Redis)
CREATE TABLE sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(category_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    compare_at_price NUMERIC(12,2),
    category_id UUID REFERENCES categories(category_id),
    seller_id UUID,
    inventory_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product variants
CREATE TABLE product_variants (
    variant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(product_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    price NUMERIC(12,2) NOT NULL,
    inventory_count INT DEFAULT 0,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product images
CREATE TABLE product_images (
    image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(product_id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text VARCHAR(500),
    sort_order INT DEFAULT 0
);

-- Cart
CREATE TABLE cart_items (
    cart_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(product_id),
    variant_id UUID REFERENCES product_variants(variant_id),
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unified Ledger (double-entry)
CREATE TABLE ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN (
        'WALLET', 'MONTHLY_TAB', 'ANNUAL_DEFERRED', 'MERCHANT_PAYABLE'
    )),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(12,2) NOT NULL,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (checkout records)
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    order_id UUID,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN (
        'VIRTUAL_WALLET', 'MONTHLY_TAB', 'PAY_NEXT_YEAR', 'PAY_NOW'
    )),
    polar_checkout_id VARCHAR(255),
    status VARCHAR(30) DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    total NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING',
    shipping_address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(product_id),
    variant_id UUID REFERENCES product_variants(variant_id),
    quantity INT NOT NULL,
    price NUMERIC(12,2) NOT NULL
);

-- Budget alerts
CREATE TABLE budget_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI scores (populated by Python cron)
CREATE TABLE financial_health_scores (
    score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    score INT NOT NULL CHECK (score BETWEEN 300 AND 850),
    factors JSONB NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_cart_items_user ON cart_items(user_id);
CREATE INDEX idx_ledger_entries_user ON ledger_entries(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_budget_alerts_user ON budget_alerts(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

---

## Inter-Service Communication

| Pattern | Protocol | Use Case |
|---------|----------|----------|
| 1-to-1 | gRPC | Rust ↔ Gleam, Rust ↔ Python |
| Many-to-many | Redis Streams | Events, notifications, queue |

---

## Environment Variables

All config from `.env` files. Never hardcoded.

```
# .env.example (committed with empty placeholders)

# ─── App ───
APP_ENV=development
APP_NAME=cartis

# ─── Cloudflare ───
CF_ACCOUNT_ID=
CF_API_TOKEN=
CF_KV_NAMESPACE_ID_SESSIONS=
CF_KV_NAMESPACE_ID_PROFILES=
WORKER_AUTH_SECRET=

# ─── OAuth2 ───
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
APPLE_REDIRECT_URI=
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_REDIRECT_URI=

# ─── PostgreSQL ───
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cartis
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_URL=

# ─── Redis ───
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=

# ─── Polar.sh ───
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_ORGANIZATION_ID=

# ─── Backend Services ───
RUST_API_HOST=0.0.0.0
RUST_API_PORT=8000
RUST_API_URL=http://localhost:8000
GLEAM_REALTIME_HOST=0.0.0.0
GLEAM_REALTIME_PORT=8001
GLEAM_REALTIME_URL=http://localhost:8001
PYTHON_AI_HOST=0.0.0.0
PYTHON_AI_PORT=8002
PYTHON_AI_URL=http://localhost:8002

# ─── Inter-service ───
INTERNAL_API_KEY=

# ─── Frontend ───
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8787/graphql
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Git Strategy (Git Flow)

```
main                    ← production-ready code
├── develop             ← integration branch
│   ├── feature/auth    ← feature branches
│   ├── feature/cart
│   ├── feature/wallet
│   └── ...
├── hotfix/fix-login    ← urgent production fixes
└── release/v1.0.0      ← release prep
```

**Rules:**
- `main` — protected, only merges from `release/` or `hotfix/`
- `develop` — integration branch, merges from `feature/*`
- Feature branches → PR into `develop` → require 1 review
- Release branches → PR into `main` + tag
- Hotfix → PR into `main` + backport to `develop`
- Branch naming: `feature/eng-123-description` (Linear issue ID)

---

## CI/CD (GitHub Actions)

**On PR:** lint, typecheck, test for all services
**On merge to main:** deploy to Cloudflare (web + gateway) and EC2 (backend)

---

## Implementation Phases

### Phase 0: Scaffold
- Turborepo workspace init
- Next.js + @opennextjs/cloudflare + Apollo Client
- CF Workers project (GraphQL gateway skeleton)
- Rust Axum + async-graphql project
- Gleam WebSocket project skeleton
- Python project with pyproject.toml
- Docker Compose (Postgres, Redis)
- SQL migrations (sqlx migrate)
- .env.example files for all apps
- CI/CD pipeline (GitHub Actions)

### Phase 1: Auth
- Google, Apple, Outlook OAuth2 flows in CF Workers
- Session: sha256(session_id + exp) → HttpOnly secure cookie
- CF KV + Redis session storage
- Login page with 3 OAuth buttons
- Apollo Client auth link

### Phase 2: Marketplace
- Product CRUD, category hierarchy, search (Postgres FTS)
- Product list, detail, category nav, search bar

### Phase 3: Cart & Checkout
- Cart CRUD, checkout orchestration
- 4 payment method selector UI

### Phase 4: Payments
- Virtual Wallet: fund via Polar.sh → deduct on checkout
- Monthly Tab: credit limit → accumulate → payday auto-debit
- Pay Next Year: Polar.sh subscription → deferred annual
- Pay Now: direct Polar.sh checkout
- Double-entry ledger for all paths

### Phase 5: Real-time
- Gleam WebSocket server via Redis
- Live inventory counters
- Order status streaming
- Budget alert push

### Phase 6: AI/ML Cron
- Financial health score (300-850)
- Spend velocity radar
- Cost swap scanner
- Recommendations
- All results saved to PostgreSQL

### Phase 7: Seller Ecosystem
- Seller dashboards + analytics
- Seller-sponsored credit
- Payout management via Polar.sh

### Phase 8: Polish
- Gamified loyalty program
- Predictive budget alerts
- Performance optimization
- Load testing
