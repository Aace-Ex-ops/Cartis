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

const QUERY = `{ analysisHistory(limit: 50) { analysisId productName price verdict explanation createdAt } }`;

function toVerdict(v: "good" | "warning" | "bad"): Verdict {
  if (v === "good") return "buy";
  if (v === "warning") return "wait";
  return "skip";
}

function formatDate(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function AnalysisHistoryPage() {
  const [items, setItems] = useState<Analysis[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ analysisHistory: Analysis[] }>(QUERY)
      .then((d) => {
        if (!cancelled) setItems(d.analysisHistory);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
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

  const analyses = (items ?? []).map((a) => ({
    id: a.analysisId,
    product: a.productName,
    price: a.price,
    verdict: toVerdict(a.verdict),
    date: formatDate(a.createdAt),
    summary: a.explanation ?? "",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Analysis History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every verdict your coach gave, in one place.</p>
      </div>
      {items === null ? (
        <div className="h-64 rounded-xl border border-border/50" />
      ) : (
        <AnalysisList analyses={analyses} />
      )}
    </div>
  );
}

export default AnalysisHistoryPage;
