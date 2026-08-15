"use client";

import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";

export type SpendingDay = { day: string; spend: number };

export function IncomeSpendingSummary({ monthlyIncome, monthlySpend, spending30d }: { monthlyIncome: number | null; monthlySpend: number | null; spending30d: SpendingDay[] }) {
  const weekly = spending30d.length > 0
    ? Array.from({ length: 5 }, (_, w) => {
        const days = spending30d.filter((d) => parseInt(d.day, 10) >= w * 7 + 1 && parseInt(d.day, 10) <= w * 7 + 7);
        return { label: `Wk ${w + 1}`, spend: days.reduce((s, d) => s + d.spend, 0) };
      })
    : [];
  const income = monthlyIncome ?? 0;
  const spend = monthlySpend ?? 0;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Income Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#132a13]">Income</h3>
            <p className="text-xs text-gray-500">Monthly</p>
          </div>
          <span className="text-lg font-black text-[#7ec151] tabular-nums">₹{income.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="mt-4 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7ec151" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spending"]}
                contentStyle={{ backgroundColor: "#ffffff", borderColor: "#7ec151", borderRadius: 12, color: "#132a13" }}
              />
              <Bar dataKey="spend" fill="#b2d959" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spending Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#132a13]">Spending</h3>
            <p className="text-xs text-gray-500">Monthly</p>
          </div>
          <span className="text-lg font-black text-[#132a13] tabular-nums">₹{spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="mt-4 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7ec151" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spending"]}
                contentStyle={{ backgroundColor: "#ffffff", borderColor: "#7ec151", borderRadius: 12, color: "#132a13" }}
              />
              <Bar dataKey="spend" fill="#7ec151" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
