"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type Insight = { title: string; detail: string; tone: string };

export const TONE: Record<string, { label: string; cls: string }> = {
  warn: { label: "Watch", cls: "bg-amber-400/15 text-amber-400 hover:bg-amber-400/15" },
  good: { label: "Grow", cls: "bg-primary/15 text-primary hover:bg-primary/15" },
  info: { label: "Info", cls: "bg-white/10 text-muted-foreground hover:bg-white/10" },
};

export function InsightCards({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {insights.map((c, i) => {
        const t = TONE[c.tone] ?? TONE.info;
        return (
          <Card key={i} className="flex flex-col">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <CardTitle className="text-[15px] leading-snug text-foreground">{c.title}</CardTitle>
              <Badge className={`shrink-0 ${t.cls}`}>{t.label}</Badge>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-[13px] leading-relaxed">{c.detail}</CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
