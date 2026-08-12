"use client";

import { useCallback, useState } from "react";
import { CashFlowChart } from "@/components/seller/cashflow-chart";
import { TrendingUp } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";
import { fetchSellerSeries, fmt, type SellerSeriesPoint } from "@/lib/seller";
import { SkeletonHeading, SkeletonCard } from "@/components/shared/dashboard-skeleton";

const DUMMY_CASHFLOW: SellerSeriesPoint[] = [
  { month: "Mar", income: 125000, expenses: 84000 },
  { month: "Apr", income: 142000, expenses: 91000 },
  { month: "May", income: 138000, expenses: 95000 },
  { month: "Jun", income: 165000, expenses: 102000 },
  { month: "Jul", income: 151000, expenses: 88000 },
  { month: "Aug", income: 189000, expenses: 94000 },
];

export default function CashFlowPage() {
  const [data, setData] = useState<SellerSeriesPoint[] | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchSellerSeries(6);
      setData(d && d.length > 0 ? d : DUMMY_CASHFLOW);
    } catch {
      setData(DUMMY_CASHFLOW);
    }
  }, []);

  useLiveData(load, [load]);
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <SkeletonCard className="h-[280px]" />
      </div>
    );
  }

  const seriesData = data.length > 0 ? data : DUMMY_CASHFLOW;

  const avgIn = seriesData.reduce((s, m) => s + m.income, 0) / Math.max(seriesData.length, 1);
  const avgOut = seriesData.reduce((s, m) => s + m.expenses, 0) / Math.max(seriesData.length, 1);
  const surplus = Math.round(avgIn - avgOut);

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Cash Flow</h1>
        <p className="mt-1 text-xs text-gray-500">Money in, money out, and net surplus velocity.</p>
      </div>

      <CashFlowChart data={seriesData.map((m) => ({ month: m.month, in: m.income, out: m.expenses }))} />

      <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <TrendingUp className="h-4 w-4 text-[#7ec151]" />
          <h2 className="text-base font-bold text-[#132a13]">Average Monthly Net Surplus</h2>
        </div>
        <div className="mt-3 text-3xl font-black text-[#132a13] tabular-nums">
          +{fmt(surplus)}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Average monthly cash reserve remaining after all operational expenses over the last 6 months.
        </p>
      </div>
    </div>
  );
}
