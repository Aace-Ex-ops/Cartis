"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsightCards, type Insight } from "@/components/shared/insight-cards";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export default function CoachPage() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    setInsights(null);
    setFailed(false);
    try {
      const res = await fetch(`${GATEWAY}/api/seller/coach`, {
        method: "POST",
        credentials: "include",
      });
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

      {insights && insights.length > 0 && <InsightCards insights={insights} />}
    </div>
  );
}
