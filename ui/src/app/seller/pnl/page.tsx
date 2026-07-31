"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pnl } from "@/lib/mock-seller";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 text-[14px] ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={strong ? "text-foreground" : ""}>{fmt(amount)}</span>
    </div>
  );
}

export default function PnLPage() {
  const net = pnl.incomeTotal - pnl.expenseTotal - pnl.gst;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profit &amp; Loss</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pnl.month} · auto-generated</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / PDF
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="border-b border-border/50 pb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Income
        </div>
        {pnl.rows.map((r) => <Row key={r.label} label={r.label} amount={r.amount} />)}
        <div className="mt-2 border-t border-border/50 pt-2">
          <Row label="Total income" amount={pnl.incomeTotal} strong />
        </div>

        <div className="mt-6 border-b border-border/50 pb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Expenses
        </div>
        {pnl.costRows.map((r) => <Row key={r.label} label={r.label} amount={r.amount} />)}
        <div className="mt-2 border-t border-border/50 pt-2">
          <Row label="Total expenses" amount={pnl.expenseTotal} strong />
          <Row label="GST (net)" amount={pnl.gst} />
        </div>

        <div className="mt-6 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
          <Row label="Net profit" amount={net} strong />
        </div>
      </div>
    </div>
  );
}
