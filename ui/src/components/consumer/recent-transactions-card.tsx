"use client";

import { ArrowRightLeft } from "lucide-react";

export type LedgerTx = {
  txnType: string;
  amount: number;
  description: string | null;
  transactionDate: string | null;
};

export function RecentTransactionsCard({ transactions }: { transactions: LedgerTx[] }) {
  const moneySpent = transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);
  const head = transactions.slice(0, 5).map((t) => ({
    id: t.txnType + t.transactionDate + t.amount,
    name: t.description ?? t.txnType,
    subtitle: t.txnType,
    amount: t.amount,
    date: t.transactionDate?.slice(0, 10) ?? "",
  }));

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-bold text-foreground">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground">₹{Math.abs(moneySpent).toLocaleString("en-IN", { minimumFractionDigits: 2 })} spent recently</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {head.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-3 transition-colors hover:bg-chart-2/10 px-1 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chart-2/30 border border-primary/20 text-foreground">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.subtitle}</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-sm font-bold tabular-nums text-foreground">
                ₹{t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-muted-foreground">{t.date}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-xl bg-chart-2/30 hover:bg-chart-2/50 border border-primary/30 py-2.5 text-xs font-bold text-foreground transition-all">
        See all other Transactions
      </button>
    </div>
  );
}
