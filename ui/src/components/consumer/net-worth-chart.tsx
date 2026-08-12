"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, ChevronDown } from "lucide-react";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CHART_DATA = [
  { date: "May 04", val: 0 },
  { date: "May 05", val: 38000 },
  { date: "May 06", val: 97567.55 },
];

export function NetWorthChart({ totalNetWorth = 97567.55 }: { totalNetWorth?: number }) {
  const [filter, setFilter] = useState("All time");

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
      {/* Header Info Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#132a13]">Net Worth</h2>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-black tracking-tight text-[#132a13] md:text-4xl tabular-nums">
              {fmt(totalNetWorth)}
            </span>
            <div className="flex items-center gap-1 text-xs font-bold text-[#132a13] bg-[#fed24f]/40 border border-[#fed24f] px-2.5 py-1 rounded-full">
              <TrendingUp className="h-3.5 w-3.5 text-[#7ec151]" />
              <span>+₹97,547.55 (487,737.75%) All-time change</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">4 / 4 accounts</span>
          <div className="relative inline-block">
            <button className="flex items-center gap-1.5 rounded-xl border border-[#7ec151]/30 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-[#b2d959]/15 transition-all shadow-sm">
              <span>{filter}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#7ec151]" />
            </button>
          </div>
        </div>
      </div>

      {/* Area Chart Container */}
      <div className="mt-6 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={CHART_DATA} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="springGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b2d959" stopOpacity={0.6} />
                <stop offset="70%" stopColor="#7ec151" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#7ec151" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#7ec151" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#7ec151" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${v >= 1000 ? `${v / 1000}K` : v}`}
              width={50}
            />
            <Tooltip
              formatter={(value) => [fmt(Number(value)), "Net Worth"]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#7ec151",
                borderRadius: "12px",
                color: "#132a13",
                boxShadow: "0 10px 25px rgba(126,193,81,0.15)",
              }}
              itemStyle={{ color: "#7ec151", fontWeight: "bold" }}
            />
            <Area
              type="monotone"
              dataKey="val"
              stroke="#7ec151"
              strokeWidth={3}
              fill="url(#springGradient)"
              activeDot={{ r: 6, fill: "#ffffff", stroke: "#7ec151", strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
