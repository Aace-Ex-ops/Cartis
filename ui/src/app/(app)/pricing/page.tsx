"use client";

import { PricingInteraction } from "@/components/ui/pricing-interaction";

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-green-50 to-white px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#132a13]">
          Choose your plan
        </h1>
        <p className="mt-2 text-gray-500">
          Start free, upgrade when you need more.
        </p>
      </div>

      <PricingInteraction
        starterMonth={9.99}
        starterAnnual={7.49}
        proMonth={19.99}
        proAnnual={17.49}
      />

      <p className="max-w-md text-center text-xs text-gray-400">
        All plans include a 14-day free trial. No credit card required for
        Free plan.
      </p>
    </div>
  );
}
