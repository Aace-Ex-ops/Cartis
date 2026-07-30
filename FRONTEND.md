# Cartis Frontend

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) → Cloudflare Pages |
| UI Library | shadcn/ui (Tailwind) |
| Charts | Recharts |
| GraphQL | Apollo Client |
| Real-time | Gleam WebSocket (native browser `WebSocket`) |
| Font | Inter |

## Theme: Spade-inspired

```
--color-bg:        #121212   (site background)
--color-surface:   #1a1a1a   (cards)
--color-elevated:  #2a2a2a   (elevated/hover cards)
--color-accent:    #10b981   (emerald green)
--color-border:    rgba(255,255,255,0.05)
--color-text:      #ffffff
--color-muted:     #9ca3af
```

Dark charcoal, emerald accent, hairline borders, minimal shadows, spacious layout.

## Layout (shared shell)

```
┌──────────────────────────────────────────┐
│ Sidebar (collapsible)   │ Header (search,│
│ Logo                    │ alerts, avatar)│
│ ─────────               ├─────────────── │
│ Consumer:               │                │
│  Home                   │  Page content  │
│  Analysis History       │  (slides in)   │
│  Budget & Spending      │                │
│  Purchase Tracker       │                │
│  Bank Account           │                │
│  Settings               │                │
│ ─────────               │                │
│ Upgrade / Credits       │                │
│ ─────────               │                │
│ User avatar + name      │                │
└──────────────────────────────────────────┘
```

Seller nav items differ but use the same shell component.

## Routes

### Consumer (`/dashboard*`)
| Path | Page | Key Components |
|---|---|---|---|
| `/dashboard` | Overview | HealthScoreCard, WalletCard, TabGauge, AlertList |
| `/dashboard/analysis` | History | AnalysisRow list, filter bar, click for coach detail |
| `/dashboard/budget` | Budget | SpendChart (area), CategoryBreakdown, month-end projection |
| `/dashboard/purchases` | Purchases | PurchaseList, CoachAdherenceRate, "You saved" total |
| `/dashboard/bank` | Bank | ConnectedAccounts, BalanceDisplay, ConsentCountdown |
| `/dashboard/settings` | Settings | OAuthLink, BudgetPrefs, AlertPrefs, NotificationChannels |

### Seller (`/seller*`)
| Path | Page | Key Components |
|---|---|---|---|
| `/seller/dashboard` | Overview | RevenueCard, ExpenseCard, ProfitMarginCard, CashOnHandCard |
| `/seller/income` | Income | IncomeChart, CategoryBreakdown, GrowthRate |
| `/seller/expenses` | Expenses | ExpenseList, CategoryPie, LargestCategories |
| `/seller/pnl` | P&L | PnLStatement (auto), PDF export |
| `/seller/tax` | GST/Tax | GSTLiability, InputTaxCredit, FilingReminders |
| `/seller/cashflow` | Cash Flow | CashFlowChart, SurplusProjection, WarningAlert |
| `/seller/inventory` | Inventory | InventoryTable, COGS, ReorderAlerts |
| `/seller/coach` | Business Coach | CoachInsight cards, same DAG pipeline |

## 21st.dev Components

| Component | ID | Use |
|---|---|---|
| Dashboard Sidebar | #14941 | Main sidebar shell (dual-theme, collapsible) |
| Financial Score Cards | #5409 | Health score gauge animation |
| Financial Dashboard | #8253 | Transaction overview cards |
| Analytics Dashboard | #6366/7787 | KPI cards with mini charts |
| Area Chart Analytics | #6611 | Spend velocity chart |

## Component Tree

```
Layout (Inter font, ApolloProvider, WebSocketProvider)
└── DashboardShell
    ├── Sidebar (21st.dev #14941)
    │   ├── Logo
    │   ├── NavItems (consumer/seller variants)
    │   ├── UpgradeWidget
    │   └── UserAvatar
    ├── HeaderBar
    │   ├── SearchBar
    │   ├── AlertBell (badge count, dropdown)
    │   └── AvatarMenu
    └── <slot> (page content)
        ├── ConsumerOverview
        │   ├── HealthScoreCard (21st.dev #5409)
        │   ├── WalletCard
        │   ├── TabGauge
        │   └── AlertList (latest 3)
        └── SellerOverview
            ├── RevenueCard
            ├── ExpenseCard
            ├── ProfitMarginCard
            └── CashOnHandCard
```

## Folder Structure

```
ui/
├── src/
│   ├── app/
│   │   ├── layout.tsx                ← root (Inter, providers)
│   │   ├── page.tsx                  ← landing/login
│   │   ├── (consumer)/
│   │   │   ├── layout.tsx            ← DashboardShell (consumer nav)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── analysis/page.tsx
│   │   │   ├── budget/page.tsx
│   │   │   ├── purchases/page.tsx
│   │   │   ├── bank/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (seller)/
│   │   │   ├── layout.tsx            ← DashboardShell (seller nav)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── income/page.tsx
│   │   │   ├── expenses/page.tsx
│   │   │   ├── pnl/page.tsx
│   │   │   ├── tax/page.tsx
│   │   │   ├── cashflow/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   └── coach/page.tsx
│   │   └── auth/callback/page.tsx
│   ├── components/
│   │   ├── ui/                       ← shadcn generated
│   │   ├── shared/
│   │   │   ├── dashboard-shell.tsx
│   │   │   ├── sidebar.tsx           ← 21st.dev #14941
│   │   │   ├── header-bar.tsx
│   │   │   ├── alert-bell.tsx
│   │   │   └── websocket-provider.tsx
│   │   ├── consumer/
│   │   │   ├── health-score-card.tsx  ← 21st.dev #5409
│   │   │   ├── wallet-card.tsx
│   │   │   ├── tab-gauge.tsx
│   │   │   ├── analysis-row.tsx
│   │   │   └── spend-chart.tsx       ← 21st.dev #6611
│   │   └── seller/
│   │       ├── revenue-card.tsx
│   │       ├── expense-card.tsx
│   │       ├── profit-margin-card.tsx
│   │       └── pnl-statement.tsx
│   ├── lib/
│   │   ├── apollo.ts
│   │   ├── websocket.ts
│   │   ├── utils.ts
│   │   └── queries/
│   │       ├── consumer.ts
│   │       └── seller.ts
│   ├── hooks/
│   │   ├── use-health-score.ts
│   │   ├── use-wallet.ts
│   │   └── use-websocket.ts
│   └── styles/
│       └── globals.css
├── tailwind.config.ts
├── next.config.ts
├── components.json
├── package.json
└── tsconfig.json
```

## Build Order

1. `pnpm create next-app` → `pnpm dlx shadcn@latest init` → scaffold `ui/`
2. Tailwind config + `globals.css` with Spade theme tokens
3. Install 21st.dev components: Dashboard Sidebar (#14941), Financial Score Cards (#5409)
4. Build `DashboardShell` (sidebar + header + content slot)
5. Build consumer Overview page (health score, wallet, tab gauge)
6. Build seller Overview page (revenue, expenses, profit margin)
7. Wire Apollo Client + WebSocket provider
8. Build remaining list/form pages
