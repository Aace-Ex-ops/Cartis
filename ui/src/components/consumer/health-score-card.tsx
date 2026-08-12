"use client";

import { ShieldCheck, TrendingUp, AlertCircle } from "lucide-react";

function scoreColor(score: number) {
  if (score >= 750) return { stroke: "#2dd4bf", shadow: "rgba(45, 212, 191, 0.4)", text: "text-teal-400" };
  if (score >= 670) return { stroke: "#f59e0b", shadow: "rgba(245, 158, 11, 0.4)", text: "text-amber-400" };
  return { stroke: "#f43f5e", shadow: "rgba(244, 63, 94, 0.4)", text: "text-rose-400" };
}

export function HealthScoreCard({ score, level, insight }: { score: number; level: string; insight: string }) {
  const theme = scoreColor(score);
  const frac = Math.max(0, Math.min(1, (score - 300) / 550));
  const r = 58;
  const c = 2 * Math.PI * r;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-teal-400/40 hover:shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Financial Health
          </h3>
          <p className="text-xs text-muted-foreground">90-day AI credit score</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${theme.text} bg-teal-500/10 border border-teal-400/20`}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {level}
        </span>
      </div>

      <div className="mt-5 flex flex-col items-center sm:flex-row sm:items-center sm:gap-6">
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
          <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
            <circle
              cx="72"
              cy="72"
              r={r}
              fill="none"
              stroke="currentColor"
              className="text-foreground/10"
              strokeWidth="10"
            />
            <circle
              cx="72"
              cy="72"
              r={r}
              fill="none"
              stroke={theme.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - frac)}
              style={{
                filter: `drop-shadow(0 0 8px ${theme.shadow})`,
                transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black tracking-tight text-foreground">{score}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              out of 850
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-center sm:mt-0 sm:text-left">
          <div className="flex items-center justify-center gap-1.5 sm:justify-start">
            <TrendingUp className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-medium text-teal-300">+18 pts this quarter</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{insight}</p>
        </div>
      </div>
    </div>
  );
}
