"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
const CURRENCY = "₹";
const inr = (n: number) => `${CURRENCY}${n.toLocaleString("en-IN")}`;

type Plan = {
  plan: string;
  name: string;
  monthly: number | null;
  yearly: number | null;
  desc: string;
  features: string[];
  cta: string;
  productId: string;
  popular?: boolean;
};

const PERSONAL_PLANS: Plan[] = [
  {
    plan: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    desc: "Core personal finance for getting started.",
    features: ["Budget & spend tracking", "AI Twin basics", "Purchase verdicts"],
    cta: "Current plan",
    productId: "",
  },
  {
    plan: "pro",
    name: "Pro",
    monthly: 499,
    yearly: 4990,
    desc: "Everything in Free, plus unlimited AI coaching.",
    features: ["Everything in Free", "Unlimited AI coaching & insights", "Price-drop alerts"],
    cta: "Upgrade to Pro",
    productId: "57780d49-cca0-43eb-91fd-6a538e261f67",
    popular: true,
  },
  {
    plan: "max",
    name: "Max",
    monthly: 1499,
    yearly: 14990,
    desc: "Everything in Pro, plus advanced analytics.",
    features: ["Everything in Pro", "Priority support", "Advanced analytics"],
    cta: "Upgrade to Max",
    productId: "c70e8ce4-7151-4705-adbf-7c828a1cb7fe",
  },
];

const BUSINESS_PLANS: Plan[] = [
  {
    plan: "team_standard",
    name: "Team · Standard",
    monthly: 4999,
    yearly: 49990,
    desc: "SMB essentials — P&L, cash flow, GST & tax, inventory.",
    features: ["Profit & Loss", "Cash flow", "GST & tax", "Inventory", "AI advisor"],
    cta: "Start Team",
    productId: "4caad456-f357-4934-8afe-b73af5b0872f",
  },
  {
    plan: "team_premium",
    name: "Team · Premium",
    monthly: 9999,
    yearly: 99990,
    desc: "Everything in Standard, plus premium seats and tools.",
    features: ["Everything in Standard", "Premium seats", "Advanced tools"],
    cta: "Go Premium",
    productId: "b5ca8384-87d0-4a59-9229-95c2be263df8",
    popular: true,
  },
  {
    plan: "enterprise",
    name: "Enterprise",
    monthly: 24999,
    yearly: null,
    desc: "All features. Up to 400 employees — above that, contact sales.",
    features: ["All features", "Up to 400 employees", "Dedicated support"],
    cta: "Contact us",
    productId: "",
  },
];

type PlanStatus = "current" | "trial" | null;

function planStatus(plan: string, effectivePlan: string): PlanStatus {
  if (effectivePlan === plan) return "current";
  if (effectivePlan === "trial" && plan === "team_standard") return "trial";
  return null;
}

function PlanCard({
  plan,
  status,
  interval,
  onSelect,
  loading,
}: {
  plan: Plan;
  status: PlanStatus;
  interval: "month" | "year";
  onSelect: (plan: Plan, interval: "month" | "year") => void;
  loading: boolean;
}) {
  const price = plan.plan === "free" ? 0 : interval === "year" ? (plan.yearly ?? plan.monthly ?? 0) : (plan.monthly ?? 0);
  const per = plan.plan === "free" ? "" : interval === "year" ? "/yr" : "/mo";
  const cta = status === "current" ? "Current plan" : plan.plan === "enterprise" ? "Contact us" : plan.cta;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 ${
        plan.popular
          ? "border-primary bg-primary/[0.03] shadow-sm"
          : "border-border bg-card"
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            <Sparkles className="h-3 w-3" /> Most popular
          </Badge>
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{plan.name}</h3>
        {status === "current" && (
          <Badge className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary" variant="outline">
            Current
          </Badge>
        )}
        {status === "trial" && (
          <Badge className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400" variant="outline">
            Trial
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-foreground">
          {plan.plan === "free" ? "Free" : inr(price)}
        </span>
        <span className="text-[12px] text-muted-foreground">{per}</span>
      </div>

      {plan.plan === "free" && interval === "year" ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Free forever</p>
      ) : (
        plan.yearly && interval === "year" && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {inr(plan.monthly ?? 0)}/mo billed yearly · 2 months free
          </p>
        )
      )}

      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{plan.desc}</p>

      <ul className="mt-4 flex flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12px] text-foreground/80">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        className="mt-5 w-full"
        variant={plan.popular ? "default" : "outline"}
        disabled={status === "current" || (!plan.productId && plan.plan !== "enterprise") || loading}
        onClick={() => onSelect(plan, interval)}
      >
        {loading ? "Redirecting…" : cta}
      </Button>
    </div>
  );
}

export function SubscriptionPanel({
  effectivePlan = "free",
  userType = "personal",
}: {
  effectivePlan?: string;
  userType?: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [tab, setTab] = useState<"personal" | "business">(
    userType === "business" || userType === "seller" ? "business" : "personal"
  );

  async function checkout(plan: Plan, billInterval: "month" | "year") {
    if (plan.plan === "enterprise") {
      window.location.href = "mailto:support@cartis.app?subject=Cartis%20Enterprise%20inquiry";
      return;
    }
    if (!plan.productId) return;
    setLoading(plan.plan);
    try {
      const res = await fetch(`${GATEWAY}/api/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: plan.productId, plan: plan.plan, interval: billInterval }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      // ignore
    }
    setLoading(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a plan. Personal finance and business plans are separate.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "personal" | "business")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="personal">Personal finance</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>

          <Tabs
            value={interval}
            onValueChange={(v) => setInterval(v as "month" | "year")}
          >
            <TabsList>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">
                Yearly
                <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  −17%
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value="personal" className="mt-0">
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            {PERSONAL_PLANS.map((plan) => (
              <PlanCard
                key={plan.plan}
                plan={plan}
                status={planStatus(plan.plan, effectivePlan)}
                interval={interval}
                onSelect={checkout}
                loading={loading === plan.plan}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="business" className="mt-0">
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            {BUSINESS_PLANS.map((plan) => (
              <PlanCard
                key={plan.plan}
                plan={plan}
                status={planStatus(plan.plan, effectivePlan)}
                interval={interval}
                onSelect={checkout}
                loading={loading === plan.plan}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
