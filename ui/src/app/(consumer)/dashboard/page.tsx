"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HealthScoreCard } from "@/components/consumer/health-score-card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { AlertList } from "@/components/consumer/alert-list";
import SpecularButton from "@/components/shared/specular-button";
import { gql } from "@/lib/gql";

type DashboardData = {
  me: { fullName: string };
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
};

const QUERY = `{
  me { fullName }
  bankAccounts { balance }
  monthlyTab { limit spent }
  financialHealthScore { score factors { key impact detail } }
  budgetAlerts { alertId alertType message createdAt }
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

const PLACEHOLDER = "h-[190px]";

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void gql<DashboardData>(QUERY)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
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
        <div className={PLACEHOLDER} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={`${PLACEHOLDER} lg:col-span-2`} />
          <div className={PLACEHOLDER} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={PLACEHOLDER} />
          <div className={`${PLACEHOLDER} lg:col-span-2`} />
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good morning, {firstName}</h1>
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

      {!hasBank && (
        <div className="mt-8 flex justify-center">
          <SpecularButton
            size="lg"
            tint="#ffffff"
            lineColor="#ffffff"
            baseColor="#525252"
            intensity={1}
            thickness={1}
            speed={0.35}
            proximity={250}
            autoAnimate={false}
            onClick={() => router.push("/onboarding")}
            className="text-center mx-auto"
          >
            Connect your first account
          </SpecularButton>
        </div>
      )}
    </div>
  );
}