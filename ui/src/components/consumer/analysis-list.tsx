"use client";

import { useState } from "react";
import { Search, CheckCircle2, Clock, Ban } from "lucide-react";
import type { Verdict } from "@/lib/mock";

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  buy: { label: "Buy", cls: "bg-[#b2d959]/50 text-[#132a13] border-[#7ec151]/40 font-extrabold", icon: CheckCircle2 },
  wait: { label: "Wait", cls: "bg-[#fed24f]/60 text-[#854d0e] border-[#fed24f] font-extrabold", icon: Clock },
  skip: { label: "Skip", cls: "bg-rose-100 text-rose-800 border-rose-200 font-extrabold", icon: Ban },
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
    <div className="flex flex-col gap-4 text-[#132a13]">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-[#7ec151]/20 bg-white p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${
                filter === f
                  ? "bg-gradient-to-r from-[#7ec151] to-[#b2d959] text-white shadow-sm"
                  : "text-gray-600 hover:bg-[#b2d959]/15 hover:text-[#132a13]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7ec151]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-xl border border-[#7ec151]/20 bg-white py-2 pl-9 pr-3 text-xs text-[#132a13] placeholder:text-gray-400 shadow-sm transition-all focus:border-[#7ec151] focus:outline-none focus:ring-1 focus:ring-[#7ec151]"
          />
        </div>
      </div>

      {/* Analysis List Container */}
      <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-[#7ec151]/20 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-xs text-gray-500">
            No analysis verdicts match your search filter.
          </div>
        )}
        {filtered.map((a) => {
          const v = VERDICT_STYLE[a.verdict];
          const VerdictIcon = v.icon;
          return (
            <div
              key={a.id}
              className="flex flex-col gap-2 p-4 transition-colors hover:bg-[#b2d959]/10 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-[#132a13]">{a.product}</span>
                  <span className="text-xs font-black tabular-nums text-[#132a13] bg-[#b2d959]/30 px-2 py-0.5 rounded-md border border-[#7ec151]/30">
                    ₹{a.price.toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{a.summary}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="text-[11px] font-semibold text-gray-400">{a.date}</span>
                <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs ${v.cls}`}>
                  <VerdictIcon className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
