"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PricingInteraction } from "@/components/ui/pricing-interaction";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
const CURRENCY = "₹";

type Plan = {
  plan: string;
  name: string;
  price: string;
  desc: string;
  cta: string;
  productId: string;
};

const PERSONAL_PLANS: Plan[] = [
  { plan: "free", name: "Free", price: "Free", desc: "Core personal finance", cta: "Current plan", productId: "" },
  { plan: "pro", name: "Pro", price: `${CURRENCY}499/mo`, desc: "Unlimited AI coaching & insights", cta: "Upgrade", productId: "57780d49-cca0-43eb-91fd-6a538e261f67" },
  { plan: "max", name: "Max", price: `${CURRENCY}1,499/mo`, desc: "Priority support & analytics", cta: "Upgrade", productId: "c70e8ce4-7151-4705-adbf-7c828a1cb7fe" },
];

const BUSINESS_PLANS = [
  {
    plan: "team_standard",
    name: "Team · Standard",
    price: `${CURRENCY}4,999/mo`,
    desc: "SMB essentials — P&L, cash flow, GST & tax, inventory, advisor.",
    cta: "Start Team",
    productId: "4caad456-f357-4934-8afe-b73af5b0872f",
  },
  {
    plan: "team_premium",
    name: "Team · Premium",
    price: `${CURRENCY}9,999/mo`,
    desc: "Everything in Standard, plus premium seats and advanced tools.",
    cta: "Go Premium",
    productId: "b5ca8384-87d0-4a59-9229-95c2be263df8",
  },
  {
    plan: "enterprise",
    name: "Enterprise",
    price: `${CURRENCY}24,999/mo`,
    desc: "All features. Up to 400 employees — above that, contact sales.",
    cta: "Contact us",
    productId: "",
  },
];

function PlanCard({
  plan,
  current,
  onSelect,
  loading,
}: {
  plan: Plan;
  current: boolean;
  onSelect: (plan: Plan) => void;
  loading: boolean;
}) {
  return (
    <Card key={plan.plan} className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-[15px]">{plan.name}</CardTitle>
          {current && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Current
            </span>
          )}
        </div>
        <span className="text-[14px] font-semibold text-foreground">{plan.price}</span>
        <CardDescription>{plan.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          disabled={current || !plan.productId || loading}
          onClick={() => onSelect(plan)}
        >
          {!plan.productId
            ? plan.plan === "enterprise"
              ? "Contact us"
              : plan.cta
            : loading
              ? "Redirecting…"
              : plan.cta}
        </Button>
        {!plan.productId && plan.plan === "enterprise" && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            <a href="mailto:support@cartis.app" className="underline">
              support@cartis.app
            </a>{" "}
            · {CURRENCY}200/mo up to 400 employees
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SubscriptionPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [personalPlan, setPersonalPlan] = useState(0);

  const checkout = useCallback(async (plan: string, productId: string) => {
    if (!productId) {
      window.location.href = "mailto:support@cartis.app?subject=Cartis%20Enterprise%20inquiry";
      return;
    }
    setLoading(plan);
    try {
      const res = await fetch(`${GATEWAY}/api/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, plan }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.assign(data.url);
    } catch { /* ignore */ }
    setLoading(null);
  }, []);

  const getStarted = useCallback(() => {
    const idx = personalPlan;
    if (idx === 0) return;
    const plan = PERSONAL_PLANS[idx];
    checkout(plan.plan, plan.productId);
  }, [personalPlan, checkout]);

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a plan. Personal finance and business plans are separate.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal finance</h2>
        <div className="mt-6 flex flex-col items-center gap-4">
          <PricingInteraction
            starterMonth={499}
            starterAnnual={399}
            proMonth={1499}
            proAnnual={1199}
            onChange={(idx) => setPersonalPlan(idx)}
          />
          <button
            onClick={getStarted}
            disabled={loading !== null || personalPlan === 0}
            className="w-full max-w-sm rounded-full bg-black p-3 text-lg text-white transition-transform duration-300 hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {loading ? "Redirecting…" : personalPlan === 0 ? "Current plan" : "Get Started"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Business</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {BUSINESS_PLANS.map((plan) => (
            <PlanCard
              key={plan.plan}
              plan={plan}
              current={false}
              onSelect={(p) => checkout(p.plan, p.productId)}
              loading={loading === plan.plan}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
