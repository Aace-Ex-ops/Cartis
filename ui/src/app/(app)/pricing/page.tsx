"use client";

import { PricingInteraction } from "@/components/ui/pricing-interaction";

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-muted to-background px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Choose your plan
        </h1>
        <p className="mt-2 text-muted-foreground">
          Start free, upgrade when you need more.
        </p>
      </div>

      <PricingInteraction
        starterMonth={9.99}
        starterAnnual={7.49}
        proMonth={19.99}
        proAnnual={17.49}
      />

      <p className="max-w-md text-center text-xs text-muted-foreground">
        All plans include a 14-day free trial. No credit card required for
        Free plan.
      </p>
    </div>
  );
}
