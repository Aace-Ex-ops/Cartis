"use client";

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function scoreColor(score: number) {
  if (score >= 750) return "#10b981";
  if (score >= 670) return "#f59e0b";
  return "#ef4444";
}

export function HealthScoreCard({ score, level, insight }: { score: number; level: string; insight: string }) {
  const color = scoreColor(score);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Health</CardTitle>
        <CardDescription>Based on the last 90 days</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div className="relative h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="72%"
              outerRadius="100%"
              barSize={10}
              data={[{ value: score }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[300, 850]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: "rgba(255,255,255,0.06)" }} />
            </RadialBarChart>
          </ResponsiveContainer>
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
