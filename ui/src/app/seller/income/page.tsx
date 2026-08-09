"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IncomeChart } from "@/components/seller/income-chart";
import { CategoryBreakdown } from "@/components/consumer/category-breakdown";
import { EntryForm } from "@/components/seller/entry-form";
import { StatCard } from "@/components/seller/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp } from "lucide-react";
import {
  fetchSellerCategories,
  fetchSellerSeries,
  fmt,
  withColors,
  type SellerCategory,
  type SellerSeriesPoint,
} from "@/lib/seller";

export default function IncomePage() {
  const [series, setSeries] = useState<SellerSeriesPoint[] | null>(null);
  const [categories, setCategories] = useState<SellerCategory[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([fetchSellerSeries(6), fetchSellerCategories("revenue")]);
      setSeries(s);
      setCategories(c);
    } catch {
      setFailed(true);
    }
  }, []);

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      load();
      loaded.current = true;
    }
  }, [load]);

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your income — refresh to try again.
      </p>
    );
  }

  if (!series || !categories) {
    return <div className="h-[190px]" />;
  }

  const first = series[0]?.income ?? 0;
  const last = series[series.length - 1]?.income ?? 0;
  const growth = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">Income</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where the money comes from.</p>
      </div>
      <StatCard title="6-month growth" value={`${growth >= 0 ? "+" : ""}${growth}%`} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IncomeChart data={series.map((m) => ({ month: m.month, income: m.income }))} />
        </div>
        <CategoryBreakdown categories={withColors(categories)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Add income</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!adding && (
            <div>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-4 w-4" /> Record sale
              </Button>
            </div>
          )}
          {adding && (
            <EntryForm
              entryType="revenue"
              onAdded={() => {
                setAdding(false);
                void load();
              }}
            />
          )}
        </CardContent>
      </Card>
      {categories.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No income recorded yet — add your first sale above. (Total this month: {fmt(categories.reduce((s, c) => s + c.spent, 0))})
        </p>
      )}
    </div>
  );
}
