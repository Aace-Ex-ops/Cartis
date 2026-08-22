"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelectAPlan, type Tier } from "@/components/ui/select-a-plan-4";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

const PERSONAL_TIERS: Tier[] = [
  {
    plan: "free",
    name: "Free",
    seatsMin: 1,
    seatsMax: 1,
    monthly: 0,
    yearly: 0,
    desc: "Core personal finance for getting started.",
    features: ["Budget & spend tracking", "AI Twin basics", "Purchase verdicts"],
    productId: "",
  },
  {
    plan: "pro",
    name: "Pro",
    seatsMin: 2,
    seatsMax: 4,
    monthly: 499,
    yearly: 4990,
    desc: "Everything in Free, plus unlimited AI coaching.",
    features: ["Everything in Free", "Unlimited AI coaching & insights", "Price-drop alerts"],
    productId: "57780d49-cca0-43eb-91fd-6a538e261f67",
    popular: true,
  },
  {
    plan: "max",
    name: "Max",
    seatsMin: 5,
    seatsMax: 14,
    monthly: 1499,
    yearly: 14990,
    desc: "Everything in Pro, plus advanced analytics.",
    features: ["Everything in Pro", "Priority support", "Advanced analytics"],
    productId: "c70e8ce4-7151-4705-adbf-7c828a1cb7fe",
  },
];

const BUSINESS_TIERS: Tier[] = [
  {
    plan: "team_standard",
    name: "Team · Standard",
    seatsMin: 15,
    seatsMax: 99,
    monthly: 4999,
    yearly: 49990,
    desc: "SMB essentials — P&L, cash flow, GST & tax, inventory.",
    features: ["Profit & Loss", "Cash flow", "GST & tax", "Inventory", "AI advisor"],
    productId: "4caad456-f357-4934-8afe-b73af5b0872f",
  },
  {
    plan: "team_premium",
    name: "Team · Premium",
    seatsMin: 100,
    seatsMax: 399,
    monthly: 9999,
    yearly: 99990,
    desc: "Everything in Standard, plus premium seats and tools.",
    features: ["Everything in Standard", "Premium seats", "Advanced tools"],
    productId: "b5ca8384-87d0-4a59-9229-95c2be263df8",
    popular: true,
  },
  {
    plan: "enterprise",
    name: "Enterprise",
    seatsMin: 400,
    seatsMax: 500,
    monthly: 24999,
    yearly: null,
    desc: "All features. Tailored to your organization.",
    features: ["All features", "Dedicated support"],
    productId: "",
  },
];

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
  const [personalSeats, setPersonalSeats] = useState(1);
  const [businessSeats, setBusinessSeats] = useState(15);

  async function checkout(tier: Tier, billInterval: "month" | "year") {
    if (tier.plan === "enterprise") {
      window.location.href = "mailto:support@cartis.app?subject=Cartis%20Enterprise%20inquiry";
      return;
    }
    if (!tier.productId) return;
    setLoading(tier.plan);
    try {
      const res = await fetch(`${GATEWAY}/api/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: tier.productId, plan: tier.plan, interval: billInterval }),
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

          <Tabs value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
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
          <div className="pt-1">
            <SelectAPlan
              tiers={PERSONAL_TIERS}
              seats={personalSeats}
              interval={interval}
              effectivePlan={effectivePlan}
              onSeatsChange={setPersonalSeats}
              onCheckout={checkout}
              loading={loading != null}
            />
          </div>
        </TabsContent>

        <TabsContent value="business" className="mt-0">
          <div className="pt-1">
            <SelectAPlan
              tiers={BUSINESS_TIERS}
              seats={businessSeats}
              interval={interval}
              effectivePlan={effectivePlan}
              onSeatsChange={setBusinessSeats}
              onCheckout={checkout}
              loading={loading != null}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}