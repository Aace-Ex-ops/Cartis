"use client";

import { PieChart, AlertTriangle } from "lucide-react";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function TabGauge({ spend, budget }: { spend: number; budget: number }) {
  const pct = budget > 0 ? Math.round((spend / budget) * 100) : 0;
  const isHigh = pct > 85;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Monthly Tab
        </h3>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
          isHigh ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-[#fed24f]/50 text-[#854d0e] border border-[#fed24f]"
        }`}>
          {isHigh ? <AlertTriangle className="h-3 w-3" /> : <PieChart className="h-3 w-3 text-[#7ec151]" />}
          {pct}% Limit Used
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        {budget > 0 ? (
          <div
            className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-1 transition-transform duration-300 group-hover:scale-105"
            style={{
              background: `conic-gradient(${
                isHigh ? "#f43f5e" : "#7ec151"
              } ${pct * 3.6}deg, #f1f5f9 0deg)`,
              boxShadow: isHigh
                ? "0 0 15px rgba(244, 63, 94, 0.2)"
                : "0 0 15px rgba(126, 193, 81, 0.2)",
            }}
          >
            <div className="flex h-22 w-22 flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <span className="text-2xl font-black text-[#132a13]">{pct}%</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                adherence
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gray-50 border border-gray-200">
            <span className="text-xs font-medium text-gray-500">No limit</span>
          </div>
        )}

        <div className="flex flex-col gap-2 text-right">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Spent this month</p>
            <p className="text-xl font-black tabular-nums text-[#132a13]">{fmt(spend)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Cap budget</p>
            <p className="text-sm font-semibold tabular-nums text-gray-500">{budget > 0 ? fmt(budget) : "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
