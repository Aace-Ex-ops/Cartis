"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { gql } from "@/lib/gql";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Point = { day: string; value: number };

const RANGES = [
  { label: "7D", days: 7, bucket: "day" },
  { label: "1M", days: 30, bucket: "day" },
  { label: "3M", days: 90, bucket: "day" },
  { label: "1Y", days: 365, bucket: "week" },
  { label: "All time", days: 3650, bucket: "month" },
] as const;

export function NetWorthChart({ accountsCount = 0 }: { accountsCount?: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [data, setData] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ netWorthSeries: Point[] }>(
      `{ netWorthSeries(bucket: "${range.bucket}", days: ${range.days}) { day value } }`,
    )
      .then((d) => {
        if (!cancelled) setData(d.netWorthSeries ?? []);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const points = data ?? [];
  const last = points[points.length - 1];
  const first = points[0];
  const hasTrend = points.length >= 2 && !!last && !!first;
  const delta = hasTrend ? last.value - first.value : null;
  const pct = delta !== null && first.value !== 0 ? (delta / Math.abs(first.value)) * 100 : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm transition-all duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Net Worth</h2>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-black tracking-tight text-foreground md:text-4xl tabular-nums">
              {last ? fmt(last.value) : fmt(0)}
            </span>
            {hasTrend && delta !== null && (
              <div
                className={`flex items-center gap-1 text-xs font-bold border px-2.5 py-1 rounded-full ${
                  delta >= 0
                    ? "text-foreground bg-chart-5/40 border-chart-5"
                    : "text-destructive bg-destructive/10 border-destructive/30"
                }`}
              >
                {delta >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span>
                  {delta >= 0 ? "+" : ""}
                  {fmt(delta)} ({pct !== null ? `${pct >= 0 ? "+" : ""}${Math.round(pct)}%` : "—"} {range.label.toLowerCase()})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {accountsCount > 0 ? `${accountsCount} ${accountsCount === 1 ? "account" : "accounts"}` : ""}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-chart-2/15 transition-all shadow-sm">
                <span>{range.label}</span>
                <ChevronDown className="h-3.5 w-3.5 text-primary" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {RANGES.map((r) => (
                <DropdownMenuItem key={r.label} onClick={() => setRange(r)}>
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-6 h-56 w-full">
        {!data ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : points.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No activity yet — your net worth history will appear here.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="springGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                  <stop offset="70%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(v >= 1_000_000 ? 0 : 1)}K` : Math.round(v)}`}
                width={60}
              />
              <Tooltip
                formatter={(value) => [fmt(Number(value)), "Net Worth"]}
                contentStyle={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--primary)",
                  borderRadius: "12px",
                  color: "var(--foreground)",
                  boxShadow: "0 10px 25px rgba(126,193,81,0.15)",
                }}
                itemStyle={{ color: "var(--primary)", fontWeight: "bold" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={3}
                fill="url(#springGradient)"
                activeDot={{ r: 6, fill: "var(--background)", stroke: "var(--primary)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
