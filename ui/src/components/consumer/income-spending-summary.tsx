"use client";

import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";

const MONTHLY_DATA = [
  { month: "Dec", income: 12500, spend: 4200 },
  { month: "Jan", income: 14200, spend: 5100 },
  { month: "Feb", income: 11800, spend: 3800 },
  { month: "Mar", income: 16500, spend: 6200 },
  { month: "Apr", income: 15100, spend: 4900 },
  { month: "May", income: 18900, spend: 5006.5 },
];

export function IncomeSpendingSummary() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Income Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#132a13]">Income</h3>
            <p className="text-xs text-gray-500">Recent 6 Months</p>
          </div>
          <span className="text-lg font-black text-[#7ec151] tabular-nums">₹18,900.00</span>
        </div>

        <div className="mt-4 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_DATA}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7ec151" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Income"]}
                contentStyle={{ backgroundColor: "#ffffff", borderColor: "#7ec151", borderRadius: 12, color: "#132a13" }}
              />
              <Bar dataKey="income" fill="#b2d959" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spending Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#132a13]">Spending</h3>
            <p className="text-xs text-gray-500">Recent 6 Months</p>
          </div>
          <span className="text-lg font-black text-[#132a13] tabular-nums">₹5,006.50</span>
        </div>

        <div className="mt-4 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_DATA}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7ec151" }} axisLine={false} tickLine={false} />
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
