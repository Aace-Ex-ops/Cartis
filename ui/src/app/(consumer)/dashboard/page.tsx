"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HealthScoreCard } from "@/components/consumer/health-score-card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { AlertList } from "@/components/consumer/alert-list";
import { TaxCard } from "@/components/consumer/tax-card";
import { SkeletonHeading, SkeletonCard } from "@/components/shared/dashboard-skeleton";
import { InsightCards, type Insight } from "@/components/shared/insight-cards";
import { gql } from "@/lib/gql";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type UserAction = {
  actionId: string;
  kind: string;
  title: string;
  detail: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

type DashboardData = {
  me: { fullName: string; monthlyIncome: number | null; monthlyTax: number | null };
  bankAccounts: { balance: number | null }[];
  monthlyTab: { limit: number; spent: number };
  financialHealthScore: {
    score: number;
    factors: { key: string; impact: string; detail: string }[];
  };
  budgetAlerts: {
    alertId: string;
    alertType: string;
    message: string;
    createdAt: string;
  }[];
  userActions: UserAction[];
};

const QUERY = `{
  me { fullName monthlyIncome monthlyTax }
  bankAccounts { balance }
  monthlyTab { limit spent }
  financialHealthScore { score factors { key impact detail } }
  budgetAlerts { alertId alertType message createdAt }
  userActions { actionId kind title detail ctaLabel ctaUrl }
}`;

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso.replace(" ", "T")).getTime()) / 1000);
  if (secs < 60) return "Just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function severityOf(alertType: string): "high" | "medium" | "low" {
  if (alertType === "BUDGET_EXHAUSTION") return "high";
  if (alertType === "OVERSPEND_RISK") return "medium";
  return "low";
}

function healthLevel(score: number): string {
  if (score >= 750) return "Good";
  if (score >= 670) return "Fair";
  return "Needs attention";
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightFailed, setInsightFailed] = useState(false);
  const [actions, setActions] = useState<UserAction[] | null>(null);
  const router = useRouter();

  async function loadInsights() {
    setInsights(null);
    setInsightFailed(false);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_URL ?? ""}/api/consumer/coach`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { insights?: Insight[]; error?: string };
      if (!res.ok || !body.insights) {
        setInsightFailed(true);
        return;
      }
      setInsights(body.insights);
    } catch {
      setInsightFailed(true);
    }
  }

  async function resolveAction(actionId: string, done: boolean) {
    try {
      await gql<unknown>(
        `mutation { setUserActionStatus(actionId: "${actionId}", status: "${done ? "done" : "dismissed"}") }`
      );
      setActions((prev) => (prev ? prev.filter((a) => a.actionId !== actionId) : prev));
    } catch {
      // keep the card; user can retry next load
    }
  }

  useEffect(() => {
    let cancelled = false;
    void gql<DashboardData>(QUERY)
      .then((d) => {
        if (cancelled) return;
        if (!d.me) {
          setFailed(true);
          return;
        }
        setData(d);
        setActions(d.userActions && d.userActions.length > 0 ? d.userActions : null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    const t = setTimeout(() => {
      void loadInsights();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load your dashboard — refresh to try again.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="h-[190px] lg:col-span-2" />
          <SkeletonCard className="h-[190px]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="h-[190px]" />
          <SkeletonCard className="h-[190px] lg:col-span-2" />
        </div>
      </div>
    );
  }

  const firstName = data.me.fullName.split(" ")[0] || "there";
  const spent = data.monthlyTab.spent;
  const budget = data.monthlyTab.limit;
  const usedPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const health = data.financialHealthScore;
  const factorInsight =
    health.factors.find((f) => f.impact === "negative")?.detail ??
    health.factors[0]?.detail;
  const insight =
    factorInsight ??
    (budget > 0
      ? `You\'ve used ${usedPct}% of your monthly tab — ${fmt(Math.max(budget - spent, 0))} remaining.`
      : "No monthly budget set yet — set one to start tracking.");

  const hasBank = data.bankAccounts && data.bankAccounts[0]?.balance !== null && data.bankAccounts[0]?.balance !== 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Good morning, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where your money stands today.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HealthScoreCard
            score={health.score}
            level={healthLevel(health.score)}
            insight={insight}
          />
        </div>
        <WalletCard
          balance={data.bankAccounts[0]?.balance ?? 0}
          monthlySpend={spent}
          monthlyBudget={budget}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TabGauge spend={spent} budget={budget} />
        <div className="lg:col-span-2">
          <AlertList
            alerts={data.budgetAlerts.map((a) => ({
              id: a.alertId,
              title: a.message,
              time: timeAgo(a.createdAt),
              severity: severityOf(a.alertType),
            }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">AI Coach</h2>
          <p className="mt-1 text-sm text-muted-foreground">Insights from your money, tax included.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadInsights()} disabled={!insights}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {insightFailed && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          Couldn&apos;t generate insights — try again.
        </p>
      )}

      {!insights && !insightFailed && <div className="h-[190px]" />}

      {insights && insights.length > 0 && <InsightCards insights={insights} />}

      {actions && actions.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Suggested actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">From your advisor — mark them done as you go.</p>
          </div>
          <div className="flex flex-col gap-2">
            {actions.map((a) => (
              <div
                key={a.actionId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{a.title}</p>
                  {a.detail && <p className="mt-0.5 text-[12px] text-muted-foreground">{a.detail}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.ctaUrl && (
                    <Button variant="outline" size="sm" onClick={() => router.push(a.ctaUrl!)}>
                      {a.ctaLabel ?? "Open"} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void resolveAction(a.actionId, true)}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Done
                  </Button>
<button
                      onClick={() => void resolveAction(a.actionId, false)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaxCard monthlyIncome={data.me.monthlyIncome} monthlyTax={data.me.monthlyTax} />

      {!hasBank && (
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => router.push("/onboarding")} className="mx-auto">
            Connect your first account
          </Button>
        </div>
      )}
    </div>
  );
}