"use client";

import { useEffect, useState } from "react";
import { AnalysisList } from "@/components/consumer/analysis-list";
import { gql } from "@/lib/gql";
import type { Verdict } from "@/lib/mock";
import { SkeletonHeading, SkeletonRow } from "@/components/shared/dashboard-skeleton";

type Analysis = {
  analysisId: string;
  productName: string;
  price: number;
  verdict: "good" | "warning" | "bad";
  explanation: string | null;
  createdAt: string;
};

const DUMMY_ANALYSES: Analysis[] = [
  {
    analysisId: "an-1",
    productName: "Apple MacBook Air M3 (16GB, 512GB SSD)",
    price: 124900,
    verdict: "warning",
    explanation: "Your monthly tab has ₹24,850 remaining. Buying this today exceeds your disposable buffer by 165%. Wait for festive sales or set a 60-day target.",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    analysisId: "an-2",
    productName: "Sony WH-1000XM5 ANC Headphones",
    price: 26990,
    verdict: "good",
    explanation: "Approved — fits cleanly within your discretionary entertainment budget while maintaining your 34% savings rate target.",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    analysisId: "an-3",
    productName: "Leather Ergonomic Executive Chair",
    price: 45000,
    verdict: "bad",
    explanation: "High price-to-utility markup. Equivalent ergonomic lumbar chairs are available for ₹18,500 without impulse tax.",
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    analysisId: "an-4",
    productName: "Keychron K2 V2 Wireless Keyboard",
    price: 8499,
    verdict: "good",
    explanation: "Approved — work equipment purchase fully covered by your monthly tech gear buffer.",
    createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    analysisId: "an-5",
    productName: "LG C3 55-inch 4K OLED Smart TV",
    price: 115000,
    verdict: "warning",
    explanation: "High impact on net liquidity before quarter-end advance tax payment. Recommend waiting 45 days until Q3 bonus allocation.",
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    analysisId: "an-6",
    productName: "Dyson V12 Detect Cordless Vacuum",
    price: 52900,
    verdict: "bad",
    explanation: "Skipped — high brand premium. Alternative robotic vacuums offer 90% cleaning performance at half the price.",
    createdAt: new Date(Date.now() - 86400000 * 19).toISOString(),
  },
  {
    analysisId: "an-7",
    productName: "Bose SoundLink Flex Bluetooth Speaker",
    price: 13900,
    verdict: "good",
    explanation: "Approved — small leisure expense well within weekend entertainment limits.",
    createdAt: new Date(Date.now() - 86400000 * 25).toISOString(),
  },
];

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

function AnalysisHistoryPage() {
  const [items, setItems] = useState<Analysis[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ analysisHistory: Analysis[] }>(QUERY)
      .then((d) => {
        if (cancelled) return;
        setItems(d.analysisHistory && d.analysisHistory.length > 0 ? d.analysisHistory : DUMMY_ANALYSES);
      })
      .catch(() => {
        if (cancelled) return;
        setItems(DUMMY_ANALYSES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  const listData = items.length > 0 ? items : DUMMY_ANALYSES;

  const analyses = listData.map((a) => ({
    id: a.analysisId,
    product: a.productName,
    price: a.price,
    verdict: toVerdict(a.verdict),
    date: formatDate(a.createdAt),
    summary: a.explanation ?? "",
  }));

  return (
    <div className="flex flex-col gap-6 text-gray-900 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Analysis History</h1>
        <p className="mt-1 text-xs text-gray-500">Every verdict, price check, and AI purchase advice in one place.</p>
      </div>

      <AnalysisList analyses={analyses} />
    </div>
  );
}

export default AnalysisHistoryPage;
