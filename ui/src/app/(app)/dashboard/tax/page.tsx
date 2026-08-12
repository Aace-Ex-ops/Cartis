"use client";

import { useCallback, useState } from "react";
import { StatCard } from "@/components/seller/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, CircleCheck } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";
import { fetchSellerDashboard, fmt, nextFiling, taxPeriod, type SellerDashboard } from "@/lib/seller";
import { SkeletonHeading, SkeletonCard, SkeletonRow } from "@/components/shared/dashboard-skeleton";

export default function TaxPage() {
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchSellerDashboard());
    } catch {
      setFailed(true);
    }
  }, []);

  useLiveData(load, [load]);

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your tax data — refresh to try again.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
          <SkeletonRow bare />
          <SkeletonRow bare />
        </div>
      </div>
    );
  }

  const gstLiability = Math.round(0.18 * data.revenue);
  const inputTaxCredit = Math.round(0.18 * data.expenses);
  const netPayable = Math.max(gstLiability - inputTaxCredit, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">GST &amp; Tax</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {taxPeriod()} return, filed by {nextFiling()}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="GST liability" value={fmt(gstLiability)} />
        <StatCard title="Input tax credit" value={fmt(inputTaxCredit)} />
        <StatCard title="Net payable" value={fmt(netPayable)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filing reminders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-4 py-3">
            <CalendarClock className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex flex-1 flex-col">
              <span className="text-[14px] text-foreground">GSTR-3B due {nextFiling()}</span>
              <span className="text-[12px] text-muted-foreground">
                Net payable {fmt(netPayable)} after ITC
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
            <CircleCheck className="h-4 w-4 shrink-0 text-primary" />
            <div className="flex flex-1 flex-col">
              <span className="text-[14px] text-foreground">ITC on every expense</span>
              <span className="text-[12px] text-muted-foreground">
                You can claim {fmt(inputTaxCredit)} of input tax this period
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
