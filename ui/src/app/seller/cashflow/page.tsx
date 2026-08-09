"use client";

import { useEffect, useState } from "react";
import { CashFlowChart } from "@/components/seller/cashflow-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { fetchSellerSeries, fmt, type SellerSeriesPoint } from "@/lib/seller";
import { SkeletonHeading, SkeletonCard } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CashFlowPage() {
  const [data, setData] = useState<SellerSeriesPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSellerSeries(6)
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
        Couldn&apos;t load your cash flow — refresh to try again.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <SkeletonCard className="h-[280px]" />
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-52" />
        </div>
      </div>
    );
  }

  const avgIn = data.reduce((s, m) => s + m.income, 0) / Math.max(data.length, 1);
  const avgOut = data.reduce((s, m) => s + m.expenses, 0) / Math.max(data.length, 1);
  const surplus = Math.round(avgIn - avgOut);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">Cash Flow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Money in, money out, and what is left.</p>
      </div>

      {data.some((m) => m.expenses > m.income) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-[14px] text-foreground">Outflows exceeded inflows</span>
            <span className="text-[12px] text-muted-foreground">
              At least one month spent more than it earned — keep an eye on expenses.
            </span>
          </div>
        </div>
      )}

      <CashFlowChart data={data.map((m) => ({ month: m.month, in: m.income, out: m.expenses }))} />

      <Card>
        <CardHeader>
          <CardTitle>Surplus projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold ${surplus >= 0 ? "text-primary" : "text-destructive"}`}>
            {surplus >= 0 ? "+" : ""}
            {fmt(surplus)}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Average monthly surplus over the last 6 months.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
