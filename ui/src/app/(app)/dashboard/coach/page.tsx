"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  Landmark,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/seller/stat-card";
import { gql } from "@/lib/gql";
import { fmt } from "@/lib/seller";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
const PRO_PRODUCT_ID = "55681814-5a2b-4312-94c0-6fef945fc0ed";

const TYPES = [
  { id: "saas", label: "SaaS" },
  { id: "d2c", label: "D2C" },
  { id: "services", label: "Services" },
  { id: "retail", label: "Retail" },
];

type Health = {
  period: string;
  businessType: string;
  kpis: {
    revenue: number;
    expenses: number;
    cogs: number;
    opex: number;
    cash: number;
    grossMarginPct: number;
    netMarginPct: number;
  };
  benchmarks: { grossMargin: number[]; netMargin: number[] };
  score: number;
  leaks: { type: string; label: string; detail: string }[];
};

type Strategies = {
  period: string;
  healthScore: number;
  fallback?: boolean;
  executiveSummary?: string;
  revenueTactics: { title: string; detail: string }[];
  capitalAllocation: { recommendation: string; detail: string };
  risks: { risk: string; severity: string; mitigation: string }[];
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBar(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function severityBadge(severity: string): string {
  if (severity === "high") return "border-red-500/40 bg-red-500/10 text-red-400";
  if (severity === "low") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  return "border-amber-500/40 bg-amber-500/10 text-amber-400";
}

function BenchmarkBar({ label, value, band }: { label: string; value: number; band: number[] }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value.toFixed(1)}%</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-elevated">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 border-l border-r border-dashed border-emerald-400/70"
          style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%` }}
          title={`Healthy band ${band[0]}-${band[1]}%`}
        />
      </div>
    </div>
  );
}

export default function AdvisorPage() {
  const [type, setType] = useState("saas");
  const [health, setHealth] = useState<Health | null>(null);
  const [strategies, setStrategies] = useState<Strategies | null>(null);
  const [pro, setPro] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, s, e] = await Promise.all([
        fetch(`${GATEWAY}/api/advisor/health`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ businessType: type }),
        }),
        fetch(`${GATEWAY}/api/advisor/strategies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ businessType: type }),
        }),
        fetch(`${GATEWAY}/api/advisor/entitlement`, { credentials: "include" }),
      ]);
      if (cancelled) return;
      if (!h.ok) return setFailed(true);
      setHealth((await h.json()) as Health);
      if (s.ok) setStrategies((await s.json()) as Strategies);
      if (e.ok) setPro(((await e.json()) as { pro: boolean }).pro);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [type]);

  useEffect(() => {
    let cancelled = false;
    gql<{ me?: { businessType?: string } | null }>("query { me { businessType } }")
      .then((d) => {
        if (cancelled) return;
        const saved = d.me?.businessType;
        if (saved && TYPES.some((t) => t.id === saved)) setType(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setBusy(true);
    try {
      const [h, s] = await Promise.all([
        fetch(`${GATEWAY}/api/advisor/health?refresh=1`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ businessType: type }),
        }),
        fetch(`${GATEWAY}/api/advisor/strategies?refresh=1`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ businessType: type }),
        }),
      ]);
      if (!h.ok) throw new Error("health failed");
      setHealth((await h.json()) as Health);
      if (s.ok) setStrategies((await s.json()) as Strategies);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function chooseType(id: string) {
    setType(id);
    void gql<{ updateUserType?: { businessType: string } }>(
      "mutation ($type: String) { updateUserType(userType: \"business\", businessType: $type) { businessType } }",
      { type: id },
    ).catch(() => {});
  }

  async function upgrade() {
    setBusy(true);
    try {
      const res = await fetch(`${GATEWAY}/api/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: PRO_PRODUCT_ID }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    }
    setBusy(false);
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
        Couldn&apos;t load the advisor — refresh to try again.
      </p>
    );
  }

  const report = health && (
    <div className="flex flex-col gap-6" id="advisor-report">
      {strategies?.executiveSummary && (
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <FileText className="h-4 w-4 text-primary" /> Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] leading-relaxed text-foreground">{strategies.executiveSummary}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Revenue" value={fmt(health.kpis.revenue)} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
        <StatCard title="Expenses" value={fmt(health.kpis.expenses)} icon={<Wallet className="h-4 w-4 text-destructive" />} />
        <StatCard title="Cash flow" value={fmt(health.kpis.cash)} icon={<Landmark className="h-4 w-4 text-primary" />} />
        <StatCard title="Health score" value={`${health.score}/100`} icon={<Target className="h-4 w-4 text-primary" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Scale className="h-4 w-4 text-primary" /> Financial Health Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className={`text-6xl font-bold tracking-tight ${scoreColor(health.score)}`}>
              {health.score}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className={`h-full rounded-full ${scoreBar(health.score)}`}
                style={{ width: `${health.score}%` }}
              />
            </div>
            <p className="text-center text-[12px] text-muted-foreground">
              {health.score >= 70
                ? "Healthy — strong margins and cash flow."
                : health.score >= 40
                  ? "Fair — margin leaks and cost lines need attention."
                  : "At risk — tighten costs and cash flow before scaling."}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Percent className="h-4 w-4 text-primary" /> Margins vs {health.businessType} benchmarks
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <BenchmarkBar
              label="Gross margin (COGS)"
              value={health.kpis.grossMarginPct}
              band={health.benchmarks.grossMargin}
            />
            <BenchmarkBar
              label="Net margin"
              value={health.kpis.netMarginPct}
              band={health.benchmarks.netMargin}
            />
          </CardContent>
        </Card>
      </div>

      {health.leaks.length > 0 && (
        <div className="flex flex-col gap-2">
          {health.leaks.map((leak) => (
            <div
              key={leak.type + leak.label}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                leak.type === "no_data"
                  ? "border-border/50 bg-background/60"
                  : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  leak.type === "no_data" ? "text-muted-foreground" : "text-amber-400"
                }`}
              />
              <div>
                <p className="text-[13px] font-medium text-foreground">{leak.label}</p>
                <p className="text-[12px] text-muted-foreground">{leak.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {strategies && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {strategies.revenueTactics.map((t, i) => (
              <Card key={i} className="print:break-inside-avoid">
                <CardContent className="flex flex-col gap-2 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Tactic {i + 1}
                  </span>
                  <p className="text-[14px] font-medium leading-snug text-foreground">{t.title}</p>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{t.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Target className="h-4 w-4 text-primary" /> Capital Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] font-medium capitalize text-foreground">
                {strategies.capitalAllocation.recommendation.replace(/-/g, " ")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">{strategies.capitalAllocation.detail}</p>
            </CardContent>
          </Card>

          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <ShieldAlert className="h-4 w-4 text-primary" /> Key Risks
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {strategies.risks.map((r, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground">{r.risk}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${severityBadge(r.severity)}`}
                    >
                      {r.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{r.mitigation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">Financial Advisor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Benchmarked health score, growth strategy and investor-ready report from your books.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {pro ? (
            <Button size="sm" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" /> Export PDF (Pro)
            </Button>
          ) : (
            <Button size="sm" onClick={() => void upgrade()} disabled={busy}>
              <Download className="mr-2 h-4 w-4" /> Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {!pro && (
        <p className="rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-[12px] text-muted-foreground print:hidden">
          <Download className="mr-1 inline h-3.5 w-3.5" />
          PDF export unlocks on the Pro plan — upgrade to export the investor-ready report as an A4 PDF.
        </p>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => chooseType(t.id)}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              type === t.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/50 bg-background/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!health && <div className="h-[190px]" />}

      {report}
    </div>
  );
}
