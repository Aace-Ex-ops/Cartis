"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSellerCategories, fmt, currentMonth, type SellerCategory } from "@/lib/seller";

function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 text-[14px] ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={strong ? "text-foreground" : ""}>{fmt(amount)}</span>
    </div>
  );
}

export default function PnLPage() {
  const [income, setIncome] = useState<SellerCategory[] | null>(null);
  const [expenses, setExpenses] = useState<SellerCategory[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchSellerCategories("revenue"), fetchSellerCategories("expense")])
      .then(([i, e]) => {
        if (!cancelled) {
          setIncome(i);
          setExpenses(e);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your P&amp;L — refresh to try again.
      </p>
    );
  }

  if (!income || !expenses) {
    return <div className="h-[190px]" />;
  }

  const incomeTotal = income.reduce((s, c) => s + c.spent, 0);
  const expenseTotal = expenses.reduce((s, c) => s + c.spent, 0);
  const gst = Math.round(0.18 * Math.max(incomeTotal - expenseTotal, 0));
  const net = incomeTotal - expenseTotal - gst;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profit &amp; Loss</h1>
          <p className="mt-1 text-sm text-muted-foreground">{currentMonth()} · auto-generated</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / PDF
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="border-b border-border/50 pb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Income
        </div>
        {incomeTotal === 0 && <p className="py-3 text-[13px] text-muted-foreground">No income recorded this month.</p>}
        {income.map((r) => <Row key={r.name} label={r.name} amount={r.spent} />)}
        <div className="mt-2 border-t border-border/50 pt-2">
          <Row label="Total income" amount={incomeTotal} strong />
        </div>

        <div className="mt-6 border-b border-border/50 pb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Expenses
        </div>
        {expenseTotal === 0 && <p className="py-3 text-[13px] text-muted-foreground">No expenses recorded this month.</p>}
        {expenses.map((r) => <Row key={r.name} label={r.name} amount={r.spent} />)}
        <div className="mt-2 border-t border-border/50 pt-2">
          <Row label="Total expenses" amount={expenseTotal} strong />
          <Row label="GST (net)" amount={gst} />
        </div>

        <div className="mt-6 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
          <Row label="Net profit" amount={net} strong />
        </div>
      </div>
    </div>
  );
}
