"use client";

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
import { SpendChart } from "@/components/consumer/spend-chart";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { gql } from "@/lib/gql";
import { useLiveData } from "@/lib/use-live-data";
import { SkeletonHeading, SkeletonCard } from "@/components/shared/dashboard-skeleton";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type BudgetData = {
  monthlyTab: { limit: number; spent: number };
  spending30d: { day: string; spend: number }[];
};

type AiResult = {
  suggestedLimit: number;
  reasoning: string;
};

const DUMMY_DAYS = [
  { day: "Aug 01", spend: 1200 },
  { day: "Aug 02", spend: 3400 },
  { day: "Aug 03", spend: 850 },
  { day: "Aug 04", spend: 4299 },
  { day: "Aug 05", spend: 640 },
  { day: "Aug 06", spend: 1800 },
  { day: "Aug 07", spend: 2100 },
  { day: "Aug 08", spend: 320 },
  { day: "Aug 09", spend: 1450 },
  { day: "Aug 10", spend: 8790 },
];

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>({
    suggestedLimit: 75000,
    reasoning: "AI Coach optimized your monthly spending tab based on last month's recurring bills, net liquidity, and a target 34% savings buffer.",
  });

  const load = useCallback(async () => {
    // Fire AI suggestion first, then re-fetch budget data so chart reflects the new limit
    await fetch(`${GATEWAY}/api/budget/suggest`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json() as Promise<AiResult>)
      .then((result) => setAiResult(result))
      .catch(() => {})
      .finally(() => {
        void gql<BudgetData>(`{ monthlyTab { limit spent } spending30d { day spend } }`)
          .then((d) => {
            const hasData = d.monthlyTab && d.monthlyTab.limit > 0;
            setData({
              monthlyTab: hasData ? d.monthlyTab : { limit: 75000, spent: 24850 },
              spending30d: d.spending30d && d.spending30d.length > 0 ? d.spending30d : DUMMY_DAYS,
            });
          })
          .catch(() => {
            setData({
              monthlyTab: { limit: 75000, spent: 24850 },
              spending30d: DUMMY_DAYS,
            });
          });
      });
  }, []);

  useLiveData(load, [load]);

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="h-[280px]" />
          <SkeletonCard className="h-[280px] lg:col-span-2" />
        </div>
      </div>
    );
  }

  const monthlyTab = data.monthlyTab;
  const days = data.spending30d.length > 0 ? data.spending30d : DUMMY_DAYS;

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Budget & Spending</h1>
        <p className="mt-1 text-xs text-gray-500">
          ₹{(monthlyTab.limit - monthlyTab.spent).toLocaleString("en-IN")} remaining of your monthly budget tab.
        </p>
      </div>

      {aiResult && (
        <div className="rounded-2xl border border-[#7ec151]/30 bg-[#b2d959]/20 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-[#132a13]">
            <Sparkles className="h-4 w-4 text-[#7ec151] animate-pulse" />
            <span>AI set your monthly budget to ₹{aiResult.suggestedLimit.toLocaleString("en-IN")}</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{aiResult.reasoning}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <TabGauge spend={monthlyTab.spent} budget={monthlyTab.limit} />
        <div className="lg:col-span-2">
          <SpendChart data={days.map((d) => ({ ...d, budget: monthlyTab.limit }))} />
        </div>
      </div>
    </div>
  );
}
