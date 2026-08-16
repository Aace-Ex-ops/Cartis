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
      <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Income</h3>
            <p className="text-xs text-muted-foreground">Monthly</p>
          </div>
          <span className="text-lg font-black text-primary tabular-nums">₹{income.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="mt-4 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spending"]}
                contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--primary)", borderRadius: 12, color: "var(--foreground)" }}
              />
              <Bar dataKey="spend" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spending Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Spending</h3>
            <p className="text-xs text-muted-foreground">Monthly</p>
          </div>
          <span className="text-lg font-black text-foreground tabular-nums">₹{spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="mt-4 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Spending"]}
                contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--primary)", borderRadius: 12, color: "var(--foreground)" }}
              />
              <Bar dataKey="spend" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}