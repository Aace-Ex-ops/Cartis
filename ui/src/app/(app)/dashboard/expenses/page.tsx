"use client";

import { useCallback, useState } from "react";
import { useLiveData } from "@/lib/use-live-data";
import { CategoryPie } from "@/components/seller/category-pie";
import { EntryForm } from "@/components/seller/entry-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { gql } from "@/lib/gql";
import {
  fetchSellerCategories,
  fetchSellerFinances,
  fmt,
  withColors,
  type SellerCategory,
  type SellerFinanceEntry,
} from "@/lib/seller";
import { SkeletonHeading, SkeletonCard, SkeletonRow } from "@/components/shared/dashboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const EXPENSE_TYPES = ["expense", "cogs", "salary", "rent", "other"];

export default function ExpensesPage() {
  const [entries, setEntries] = useState<SellerFinanceEntry[] | null>(null);
  const [categories, setCategories] = useState<SellerCategory[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, c] = await Promise.all([fetchSellerFinances(50), fetchSellerCategories("expense")]);
      setEntries(f.filter((e) => EXPENSE_TYPES.includes(e.entryType)));
      setCategories(c);
    } catch {
      setFailed(true);
    }
  }, []);

  useLiveData(load, [load]);

  async function remove(entryId: string) {
    await gql(`mutation { deleteFinanceEntry(entryId: "${entryId}") }`);
    void load();
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your expenses — refresh to try again.
      </p>
    );
  }

  if (!entries || !categories) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 lg:col-span-2">
            <Skeleton className="h-4 w-32" />
            <SkeletonRow bare />
            <SkeletonRow bare />
            <SkeletonRow bare />
          </div>
          <SkeletonCard className="h-[280px]" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <Skeleton className="h-4 w-36" />
          <div className="mt-3 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  const top3 = [...categories].sort((a, b) => b.spent - a.spent).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every rupee out, categorized.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest expenses</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border/50">
              {entries.length === 0 && (
                <p className="py-3 text-[13px] text-muted-foreground">No expenses recorded yet.</p>
              )}
              {entries.map((e) => (
                <div key={e.entryId} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {e.description || e.category || "Expense"}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {e.transactionDate.slice(0, 10)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    {e.category ?? e.entryType}
                  </Badge>
                  <span className="w-24 text-right text-[14px] text-foreground">{fmt(e.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => void remove(e.entryId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <CategoryPie title="By category" data={withColors(categories)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Largest categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {top3.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Nothing to show yet this month.</p>
          )}
          {top3.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3 text-[14px]">
              <span className="w-5 text-muted-foreground">#{i + 1}</span>
              <span className="flex-1 text-foreground">{c.name}</span>
              <span className="font-medium text-foreground">{fmt(c.spent)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add expense</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!adding && (
            <div>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-4 w-4" /> Record expense
              </Button>
            </div>
          )}
          {adding && (
            <EntryForm
              entryType="expense"
              onAdded={() => {
                setAdding(false);
                void load();
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
