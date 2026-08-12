"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function CashFlowChart({ data }: {
  data: { month: string; in: number; out: number }[];
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#7ec151]/20 bg-white p-6 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#132a13]">Monthly Inflows & Outflows</h3>
        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-md bg-[#b2d959]" />
            <span className="text-gray-600">Inflows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-md bg-[#7ec151]" />
            <span className="text-gray-600">Outflows</span>
          </div>
        </div>
      </div>

      <div className="mt-6 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7ec151" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#7ec151" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              width={46}
            />
            <Tooltip
              formatter={(value) => fmt(Number(value))}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#7ec151",
                borderRadius: "12px",
                color: "#132a13",
                boxShadow: "0 10px 25px rgba(126,193,81,0.15)",
              }}
              labelStyle={{ color: "#7ec151", fontWeight: "bold" }}
            />
            <Bar dataKey="in" name="Inflow" fill="#b2d959" radius={[6, 6, 0, 0]} />
            <Bar dataKey="out" name="Outflow" fill="#7ec151" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
