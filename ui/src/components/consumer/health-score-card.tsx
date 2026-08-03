"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function scoreColor(score: number) {
  if (score >= 750) return "#10b981";
  if (score >= 670) return "#f59e0b";
  return "#ef4444";
}

export function HealthScoreCard({ score, level, insight }: { score: number; level: string; insight: string }) {
  const color = scoreColor(score);
  const frac = Math.max(0, Math.min(1, (score - 300) / 550));
  const r = 62;
  const c = 2 * Math.PI * r;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Health</CardTitle>
        <CardDescription>Based on the last 90 days</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
            <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <circle
              cx="72"
              cy="72"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - frac)}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold text-foreground">{score}</span>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">/ 850</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">{level}</span>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{insight}</p>
        </div>
      </CardContent>
    </Card>
  );
}
