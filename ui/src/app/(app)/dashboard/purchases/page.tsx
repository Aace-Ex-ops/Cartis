"use client";

import { useEffect, useState } from "react";
import { PiggyBank, Award, CheckCircle2, Clock, Ban } from "lucide-react";
import { gql } from "@/lib/gql";
import type { Verdict } from "@/lib/mock";
import { SkeletonHeading, SkeletonCard, SkeletonRow } from "@/components/shared/dashboard-skeleton";

type Analysis = {
  analysisId: string;
  productName: string;
  price: number;
  verdict: "good" | "warning" | "bad";
  explanation: string | null;
  createdAt: string;
};

const DUMMY_PURCHASES: Analysis[] = [
  {
    analysisId: "an-1",
    productName: "Apple MacBook Air M3 (16GB, 512GB SSD)",
    price: 124900,
    verdict: "warning",
    explanation: "Saved ₹1,24,900 by waiting for Diwali sale.",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    analysisId: "an-2",
    productName: "Sony WH-1000XM5 ANC Headphones",
    price: 26990,
    verdict: "good",
    explanation: "Purchased within entertainment budget.",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    analysisId: "an-3",
    productName: "Leather Ergonomic Executive Chair",
    price: 45000,
    verdict: "bad",
    explanation: "Skipped impulse purchase. Saved ₹45,000.",
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    analysisId: "an-4",
    productName: "Keychron K2 V2 Wireless Keyboard",
    price: 8499,
    verdict: "good",
    explanation: "Purchased using tech gear buffer.",
    createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    analysisId: "an-5",
    productName: "Dyson V12 Detect Cordless Vacuum",
    price: 52900,
    verdict: "bad",
    explanation: "Skipped impulse purchase. Saved ₹52,900.",
    createdAt: new Date(Date.now() - 86400000 * 19).toISOString(),
  },
];

const VERDICT_STYLE: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  buy: { label: "Buy", cls: "bg-[#b2d959]/50 text-[#132a13] border-[#7ec151]/40 font-extrabold", icon: CheckCircle2 },
  wait: { label: "Wait", cls: "bg-[#fed24f]/60 text-[#854d0e] border-[#fed24f] font-extrabold", icon: Clock },
  skip: { label: "Skip", cls: "bg-rose-100 text-rose-800 border-rose-200 font-extrabold", icon: Ban },
};

const QUERY = `{ analysisHistory(limit: 50) { analysisId productName price verdict explanation createdAt } }`;

function toVerdict(v: "good" | "warning" | "bad"): Verdict {
  if (v === "good") return "buy";
  if (v === "warning") return "wait";
  return "skip";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.replace(" ", "T"));
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "Recent";
  }
}

export default function PurchasesPage() {
  const [items, setItems] = useState<Analysis[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ analysisHistory: Analysis[] }>(QUERY)
      .then((d) => {
        if (!cancelled) setItems(d.analysisHistory && d.analysisHistory.length > 0 ? d.analysisHistory : DUMMY_PURCHASES);
      })
      .catch(() => {
        if (!cancelled) setItems(DUMMY_PURCHASES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  const listData = items.length > 0 ? items : DUMMY_PURCHASES;

  const purchases = listData.map((a) => {
    const verdict = toVerdict(a.verdict);
    return { id: a.analysisId, product: a.productName, price: a.price, date: formatDate(a.createdAt), verdict, saved: verdict === "buy" ? 0 : a.price };
  });

  const saved = purchases.reduce((s, p) => s + p.saved, 0);
  const decided = purchases.length;
  const followed = purchases.filter((p) => p.verdict === "buy").length;
  const adherence = decided > 0 ? Math.round((followed / decided) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 text-[#132a13] pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#132a13] md:text-3xl">Purchase Tracker</h1>
        <p className="mt-1 text-xs text-gray-500">What your coach advised, what you decided, and total money saved.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>Total Impulse Savings</span>
            <PiggyBank className="h-4 w-4 text-[#7ec151]" />
          </div>
          <p className="mt-3 text-3xl font-black text-[#132a13] tabular-nums">
            ₹{saved.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-[#7ec151] font-semibold">Saved by skipping unnecessary purchases</p>
        </div>

        <div className="rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>Coach Adherence</span>
            <Award className="h-4 w-4 text-[#7ec151]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#132a13]">{adherence}%</span>
            <span className="text-xs text-gray-500 font-semibold">of {decided} decisions followed</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[#7ec151]" style={{ width: `${adherence}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-[#7ec151]/20 bg-white shadow-sm overflow-hidden">
        {purchases.map((p) => {
          const v = VERDICT_STYLE[p.verdict];
          const VerdictIcon = v.icon;
          return (
            <div key={p.id} className="flex items-center justify-between gap-4 p-4 hover:bg-[#b2d959]/10 transition-colors">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-[#132a13]">{p.product}</span>
                <span className="text-xs text-gray-500">{p.date}</span>
              </div>
              <span className="text-xs font-black tabular-nums text-[#132a13] bg-[#b2d959]/30 px-2.5 py-1 rounded-md border border-[#7ec151]/30">
                ₹{p.price.toLocaleString("en-IN")}
              </span>
              <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs ${v.cls}`}>
                <VerdictIcon className="h-3.5 w-3.5" />
                <span className="capitalize">{v.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
