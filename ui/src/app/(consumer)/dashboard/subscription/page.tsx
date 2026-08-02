"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

const PLANS = [
  {
    productId: "55681814-5a2b-4312-94c0-6fef945fc0ed",
    name: "Monthly",
    price: "$5/month",
    desc: "Unlimited coach analyses, budget suggestions, and AI Twin.",
  },
  {
    productId: "8ec4fb7d-6be0-4da5-b658-0cd9e103fb44",
    name: "Annual",
    price: "$48/year",
    desc: "Same as Monthly, save 20%. Best value.",
  },
  {
    productId: "596f42f7-61c2-4183-89fd-c1d8eac4af6c",
    name: "One-Time Coaching",
    price: "$25",
    desc: "Single in-depth product-purchase coaching session. No subscription required.",
  },
];

export default function SubscriptionPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(productId: string) {
    setLoading(productId);
    try {
      const res = await fetch(`${GATEWAY}/api/subscription/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // ignore
    }
    setLoading(null);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upgrade to unlock unlimited coaching and smarter budgeting.</p>
      </div>

      <div className="flex flex-col gap-3">
        {PLANS.map((plan) => (
          <Card key={plan.productId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[15px]">{plan.name}</CardTitle>
                <span className="text-[14px] font-semibold text-foreground">{plan.price}</span>
              </div>
              <CardDescription>{plan.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => checkout(plan.productId)}
                disabled={loading === plan.productId}
                className="w-full"
              >
                {loading === plan.productId ? "Redirecting…" : "Subscribe"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
