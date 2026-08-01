"use client";

import { useEffect, useState } from "react";
import { SpendChart } from "@/components/consumer/spend-chart";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { gql } from "@/lib/gql";

type BudgetData = {
  monthlyTab: { limit: number; spent: number };
  spending30d: { day: string; spend: number }[];
};

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<BudgetData>(`{ monthlyTab { limit spent } spending30d { day spend } }`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ monthlyTab: { limit: 0, spent: 0 }, spending30d: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monthlyTab = data?.monthlyTab ?? { limit: 0, spent: 0 };
  const days = data?.spending30d ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Budget & Spending</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data === null
            ? "Loading…"
            : monthlyTab.limit > 0
              ? `₹${(monthlyTab.limit - monthlyTab.spent).toLocaleString("en-IN")} left of your monthly tab.`
              : "No monthly budget set yet — set one in Settings."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TabGauge spend={monthlyTab.spent} budget={monthlyTab.limit} />
        <div className="lg:col-span-2">
          {data === null ? (
            <div className="h-[280px] rounded-xl border border-border/50" />
          ) : days.length === 0 ? (
            <div className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-border/50">
              <span className="text-[13px] text-muted-foreground">No spending data yet</span>
              <span className="text-[12px] text-muted-foreground/70">
                Sync your bank alerts and the chart fills in.
              </span>
            </div>
          ) : (
            <SpendChart data={days.map((d) => ({ ...d, budget: monthlyTab.limit }))} />
          )}
        </div>
      </div>
    </div>
  );
}
