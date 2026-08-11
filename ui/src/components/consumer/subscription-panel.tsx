"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  {
    plan: "free",
    name: "Free",
    price: "Free",
    desc: "Core personal finance — budget, spend tracking, AI Twin basics.",
    cta: "Current plan",
    productId: "",
  },
  {
    plan: "pro",
    name: "Pro",
    price: `${CURRENCY}499/mo`,
    desc: "Everything in Free, plus unlimited AI coaching and insights.",
    cta: "Upgrade to Pro",
    productId: "9afd6c39-4e44-47f8-bd76-38c5b8166324",
  },
  {
    plan: "max",
    name: "Max",
    price: `${CURRENCY}1,499/mo`,
    desc: "Everything in Pro, plus priority support and advanced analytics.",
    cta: "Upgrade to Max",
    productId: "78bc8c82-a1b1-4fc6-a7a0-680b55fa63f8",
  },
];

const BUSINESS_PLANS: Plan[] = [
  {
    plan: "team_standard",
    name: "Team · Standard",
    price: `${CURRENCY}4,999/mo`,
    desc: "SMB essentials — P&L, cash flow, GST & tax, inventory, advisor.",
    cta: "Start Team",
    productId: "cc1b8227-db5b-4909-9b7a-12b24a8e8ff4",
  },
  {
    plan: "team_premium",
    name: "Team · Premium",
    price: `${CURRENCY}9,999/mo`,
    desc: "Everything in Standard, plus premium seats and advanced tools.",
    cta: "Go Premium",
    productId: "b67bf07d-9007-4880-86ab-b982f85f7119",
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

  async function checkout(plan: Plan) {
    if (!plan.productId) {
      window.location.href = "mailto:support@cartis.app?subject=Cartis%20Enterprise%20inquiry";
      return;
    }
    setLoading(plan.plan);
    try {
      const res = await fetch(`${GATEWAY}/api/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: plan.productId, plan: plan.plan }),
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
    <div className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick a plan. Personal finance and business plans are separate.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal finance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PERSONAL_PLANS.map((plan) => (
            <PlanCard
              key={plan.plan}
              plan={plan}
              current={plan.plan === "free"}
              onSelect={checkout}
              loading={loading === plan.plan}
            />
          ))}
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
              onSelect={checkout}
              loading={loading === plan.plan}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
