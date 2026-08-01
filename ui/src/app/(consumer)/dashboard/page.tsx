"use client";

import { useEffect, useState } from "react";
import { HealthScoreCard } from "@/components/consumer/health-score-card";
import { WalletCard } from "@/components/consumer/wallet-card";
import { TabGauge } from "@/components/consumer/tab-gauge";
import { AlertList } from "@/components/consumer/alert-list";
import { gql } from "@/lib/gql";

type DashboardData = {
  me: { fullName: string; financialHealthScore: number };
  wallet: { balance: number; tabLimit: number; deferredLimit: number };
  monthlyTab: { limit: number; spent: number };
  budgetAlerts: {
    alertId: string;
    alertType: string;
    message: string;
    createdAt: string;
  }[];
};

const QUERY = `{
  me { fullName financialHealthScore }
  wallet { balance }
  monthlyTab { limit spent }
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
  const insight =
    budget > 0
      ? `You've used ${usedPct}% of your monthly tab — ${fmt(Math.max(budget - spent, 0))} remaining.`
      : "No monthly budget set yet — set one to start tracking.";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Good morning, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where your money stands today.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HealthScoreCard
            score={data.me.financialHealthScore}
            level={healthLevel(data.me.financialHealthScore)}
            insight={insight}
          />
        </div>
        <WalletCard
          balance={data.wallet.balance}
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
    </div>
  );
}
