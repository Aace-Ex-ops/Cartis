"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, GripVertical } from "lucide-react";
import { AccountsTree, type BankAccount, type Holding } from "@/components/consumer/accounts-tree";
import { NetWorthChart } from "@/components/consumer/net-worth-chart";
import { RecentTransactionsCard, type LedgerTx } from "@/components/consumer/recent-transactions-card";
import { BillsIncomeCard, type IncomeStream } from "@/components/consumer/bills-income-card";
import { IncomeSpendingSummary, type SpendingDay } from "@/components/consumer/income-spending-summary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getMe, type User } from "@/lib/auth";
import { gql } from "@/lib/gql";
import { useLiveData } from "@/lib/use-live-data";

type HomeData = {
  bankAccounts: BankAccount[];
  holdings: Holding[];
  ledgerTransactions: LedgerTx[];
  incomeStreams: IncomeStream[];
  spending30d: SpendingDay[];
  me: { monthlyIncome: number | null; monthlySpend: number | null } | null;
};

const QUERY = `{
  bankAccounts { accountId bankName balance }
  holdings { holdingId assetType name quantity currentPrice }
  ledgerTransactions(limit: 5) { txnType amount description transactionDate }
  incomeStreams { source frequency amount currency fromDate }
  spending30d { day spend }
  me { monthlyIncome monthlySpend }
}`;

type WidgetId = "netWorth" | "transactions" | "bills" | "incomeSpending";
const WIDGETS: { id: WidgetId; label: string }[] = [
  { id: "netWorth", label: "Net worth chart" },
  { id: "transactions", label: "Recent transactions" },
  { id: "bills", label: "Bills & income" },
  { id: "incomeSpending", label: "Income & spending" },
];
const LS_KEY = "cartis:dashboard-layout";
type Layout = { order: WidgetId[]; hidden: WidgetId[] };
const DEFAULT_LAYOUT: Layout = {
  order: ["netWorth", "transactions", "bills", "incomeSpending"],
  hidden: [],
};

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const p = JSON.parse(raw) as Partial<Layout>;
    const order = (p.order ?? []).filter((id): id is WidgetId => WIDGETS.some((w) => w.id === id));
    const hidden = (p.hidden ?? []).filter((id): id is WidgetId => WIDGETS.some((w) => w.id === id));
    return { order: order.length ? order : DEFAULT_LAYOUT.order, hidden };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(l: Layout) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(l));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function PersonalDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>(() =>
    typeof window === "undefined" ? DEFAULT_LAYOUT : loadLayout(),
  );
  const dragId = useRef<WidgetId | null>(null);

  useEffect(() => {
    void getMe().then((u) => {
      if (u) setUser(u);
    });
  }, []);

  useLiveData(() => {
    void gql<HomeData>(QUERY)
      .then(setData)
      .catch(() => setData(null));
  });

  const setHidden = (id: WidgetId, hidden: boolean) =>
    setLayout((l) => {
      const next: Layout = {
        ...l,
        hidden: hidden ? [...new Set([...l.hidden, id])] : l.hidden.filter((h) => h !== id),
      };
      saveLayout(next);
      return next;
    });

  const moveBefore = (dragged: WidgetId, target: WidgetId) =>
    setLayout((l) => {
      const from = l.order.indexOf(dragged);
      const to = l.order.indexOf(target);
      if (from === -1 || to === -1 || from === to) return l;
      const order = [...l.order];
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item);
      const next: Layout = { ...l, order };
      saveLayout(next);
      return next;
    });

  const hidden = (id: WidgetId) => layout.hidden.includes(id);
  const firstName = user?.name ? user.name.split(" ")[0] : "Sam";
  const bankBalance = (data?.bankAccounts ?? []).reduce((s, a) => s + (a.balance ?? 0), 0);
  const holdingsValue = (data?.holdings ?? []).reduce((s, h) => s + (h.quantity ?? 0) * (h.currentPrice ?? 0), 0);
  const totalNetWorth = bankBalance + holdingsValue;

  const widgets: Record<WidgetId, React.ReactNode> = {
    netWorth: <NetWorthChart accountsCount={(data?.bankAccounts ?? []).length} />,
    transactions: <RecentTransactionsCard transactions={data?.ledgerTransactions ?? []} />,
    bills: <BillsIncomeCard streams={data?.incomeStreams ?? []} />,
    incomeSpending: (
      <IncomeSpendingSummary
        monthlyIncome={data?.me?.monthlyIncome ?? null}
        monthlySpend={data?.me?.monthlySpend ?? null}
        spending30d={data?.spending30d ?? []}
      />
    ),
  };

  return (
    <div className="relative flex flex-col gap-6 text-foreground pb-12">
      {/* Top Greeting Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Hello, {firstName}! 👋
        </h1>

        <button
          onClick={() => setCustomizeOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-4 py-2 text-xs font-bold text-foreground hover:bg-chart-2/15 transition-all shadow-sm"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          <span>Customize</span>
        </button>
      </div>

      {/* Main Mobbin 2-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Accounts Tree Panel */}
        <div className="lg:col-span-1">
          <AccountsTree accounts={data?.bankAccounts ?? []} holdings={data?.holdings ?? []} totalNetWorth={totalNetWorth} />
        </div>

        {/* Right Column: widgets in saved order */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {layout.order.filter((id) => !hidden(id)).map((id) => (
            <div key={id}>{widgets[id]}</div>
          ))}
        </div>
      </div>

      {/* Customize: toggle + reorder */}
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize dashboard</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {layout.order.map((id) => {
              const w = WIDGETS.find((x) => x.id === id);
              if (!w) return null;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => (dragId.current = id)}
                  onDragEnd={() => (dragId.current = null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId.current && dragId.current !== id) moveBefore(dragId.current, id);
                    dragId.current = null;
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                    <span className="text-sm text-foreground">{w.label}</span>
                  </div>
                  <Switch checked={!hidden(id)} onCheckedChange={(v) => setHidden(id, !v)} aria-label={`Show ${w.label}`} />
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Drag to reorder. Choices are saved on this device.</p>
        </DialogContent>
      </Dialog>

      {/* Floating Action AI Button - opens AI Twin */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("cartis:open-twin"))}
        className="fixed bottom-8 right-8 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-primary via-chart-2 to-chart-5 text-white shadow-[0_0_20px_rgba(126,193,81,0.5)] transition-transform duration-300 hover:scale-110 active:scale-95"
        title="Cartis AI Advisor"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}