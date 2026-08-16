"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type IncomeStream = {
  source: string;
  frequency: string;
  amount: number;
  currency: string;
  fromDate: string | null;
};

export function BillsIncomeCard({ streams }: { streams: IncomeStream[] }) {
  const items = streams.slice(0, 4).map((s) => ({
    id: s.source + s.frequency + s.amount,
    badge: "₹",
    badgeBg: "bg-chart-2/40 text-foreground border-primary/30",
    dateTag: s.frequency,
    title: s.source,
    amount: `+₹${s.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    amountColor: "text-primary",
  }));

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h3 className="text-base font-bold text-foreground">Bills & Income</h3>
        <div className="flex items-center gap-1">
          <button className="rounded-full p-1 text-muted-foreground hover:bg-chart-2/20 hover:text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="rounded-full p-1 text-muted-foreground hover:bg-chart-2/20 hover:text-primary transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between rounded-xl border border-border bg-muted/50 p-3.5 transition-all duration-300 hover:bg-chart-2/10"
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${item.badgeBg}`}>
                {item.badge}
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground truncate">{item.dateTag}</span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
              <p className={`text-sm font-black tabular-nums mt-0.5 ${item.amountColor}`}>
                {item.amount}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-xl bg-chart-2/30 hover:bg-chart-2/50 border border-primary/30 py-2.5 text-xs font-bold text-foreground transition-all">
        See all Bills & Income
      </button>
    </div>
  );
}
