"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/seller/stat-card";
import { TrendingUp, Wallet, Percent, Landmark } from "lucide-react";
import { fetchSellerDashboard, fmt, type SellerDashboard } from "@/lib/seller";

export default function SellerDashboardPage() {
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSellerDashboard()
      .then((d) => {
        if (!cancelled) setData(d);
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
        Couldn&apos;t load your business data — refresh to try again.
      </p>
    );
  }

  if (!data) {
    return <div className="h-[190px]" />;
  }

  const revDelta =
    data.lastMonthRevenue > 0
      ? Math.round(((data.revenue - data.lastMonthRevenue) / data.lastMonthRevenue) * 100)
      : null;
  const expDelta =
    data.lastMonthExpenses > 0
      ? Math.round(((data.expenses - data.lastMonthExpenses) / data.lastMonthExpenses) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">Business Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your shop at a glance — live from your books.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Revenue"
          value={fmt(data.revenue)}
          delta={revDelta === null ? undefined : { pct: revDelta, direction: "up" }}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
        <StatCard
          title="Expenses"
          value={fmt(data.expenses)}
          delta={expDelta === null ? undefined : { pct: expDelta, direction: "up", good: false }}
          icon={<Wallet className="h-4 w-4 text-destructive" />}
        />
        <StatCard title="Profit margin" value={`${Math.round(data.profitMargin)}%`} icon={<Percent className="h-4 w-4 text-primary" />} />
        <StatCard title="Cash on hand" value={fmt(data.cashOnHand)} icon={<Landmark className="h-4 w-4 text-muted-foreground" />} />
      </div>
    </div>
  );
}
