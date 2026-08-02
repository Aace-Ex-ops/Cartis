"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Verdict } from "@/lib/mock";

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  buy: { label: "Buy", cls: "bg-primary/15 text-primary hover:bg-primary/15" },
  wait: { label: "Wait", cls: "bg-amber-400/15 text-amber-400 hover:bg-amber-400/15" },
  skip: { label: "Skip", cls: "bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

const FILTERS: ("all" | Verdict)[] = ["all", "buy", "wait", "skip"];

export function AnalysisList({ analyses }: {
  analyses: { id: string; product: string; price: number; verdict: Verdict; date: string; summary: string }[];
}) {
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const [query, setQuery] = useState("");

  const filtered = analyses.filter(
    (a) =>
      (filter === "all" || a.verdict === filter) &&
      a.product.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-[13px] capitalize transition-colors ${
              filter === f
                ? "bg-white/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            {f}
          </button>
        ))}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="ml-auto w-56"
        />
      </div>

      <div className="flex flex-col divide-y divide-border/50 rounded-xl border border-border/50 bg-card">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            No analyses match.
          </div>
        )}
        {filtered.map((a) => {
          const v = VERDICT_STYLE[a.verdict];
          return (
            <div key={a.id} className="flex flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-foreground">{a.product}</span>
                  <span className="text-[13px] text-muted-foreground">₹{a.price.toLocaleString("en-IN")}</span>
                </div>
                <span className="text-[12px] text-muted-foreground">{a.summary}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-muted-foreground">{a.date}</span>
                <Badge className={`min-w-12 justify-center ${v.cls}`}>{v.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
