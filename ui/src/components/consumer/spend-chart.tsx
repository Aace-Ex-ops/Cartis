"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, TrendingUp } from "lucide-react";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function SpendChart({
  data,
}: {
  data: { day: string; spend: number; budget: number }[];
}) {
  const [timeframe, setTimeframe] = useState<"30d" | "7d">("30d");
  const filteredData = timeframe === "7d" ? data.slice(-7) : data;
  const avgSpend = Math.round(data.reduce((acc, d) => acc + d.spend, 0) / (data.length || 1));

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#b2d959]/30 text-[#132a13] border border-[#7ec151]/30">
            <Activity className="h-4 w-4 text-[#7ec151]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#132a13]">Spending Velocity</h3>
            <p className="text-xs text-gray-500">Daily transaction flow & volatility</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#fed24f]/50 border border-[#fed24f] px-3 py-1 text-xs font-bold text-[#854d0e]">
            <TrendingUp className="h-3.5 w-3.5 text-[#7ec151]" />
            <span>Avg {fmt(avgSpend)}/day</span>
          </div>

          <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              onClick={() => setTimeframe("30d")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                timeframe === "30d" ? "bg-gradient-to-r from-[#7ec151] to-[#b2d959] text-white shadow-sm" : "text-gray-600 hover:text-[#132a13]"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeframe("7d")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                timeframe === "7d" ? "bg-gradient-to-r from-[#7ec151] to-[#b2d959] text-white shadow-sm" : "text-gray-600 hover:text-[#132a13]"
              }`}
            >
              7 Days
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="spendLimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b2d959" stopOpacity={0.6} />
                <stop offset="70%" stopColor="#7ec151" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#7ec151" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "#7ec151" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#7ec151" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              width={46}
            />
            <Tooltip
              formatter={(value) => [fmt(Number(value)), "Spend"]}
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
              dataKey="spend"
              stroke="#7ec151"
              strokeWidth={3}
              fill="url(#spendLimeGradient)"
              activeDot={{ r: 6, fill: "#ffffff", stroke: "#7ec151", strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
