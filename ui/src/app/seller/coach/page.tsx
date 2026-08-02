"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const TONE: Record<string, { label: string; cls: string }> = {
  warn: { label: "Watch", cls: "bg-amber-400/15 text-amber-400 hover:bg-amber-400/15" },
  good: { label: "Grow", cls: "bg-primary/15 text-primary hover:bg-primary/15" },
  info: { label: "Info", cls: "bg-white/10 text-muted-foreground hover:bg-white/10" },
};

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type Insight = { title: string; detail: string; tone: string };

export default function CoachPage() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setInsights(null);
    setFailed(false);
    try {
      const res = await fetch(`${GATEWAY}/api/seller/coach`, { credentials: "include" });
      const body = (await res.json()) as { insights?: Insight[]; error?: string };
      if (!res.ok || !body.insights) {
        setFailed(true);
        return;
      }
      setInsights(body.insights);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t generate insights — try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Business Coach</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI insights from your numbers — refreshed on demand.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={!insights}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {!insights && <div className="h-[190px]" />}

      {insights && insights.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No insights yet — add some income or expenses and refresh.
        </p>
      )}

      {insights && insights.length > 0 && (
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
      )}
    </div>
  );
}
