"use client";

import { useMemo } from "react";
import { Check, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const CURRENCY = "₹";
const inr = (n: number | null) =>
  n === null ? "Custom" : `${CURRENCY}${n.toLocaleString("en-IN")}`;

export type Tier = {
  plan: string;
  name: string;
  seatsMin: number;
  seatsMax: number;
  monthly: number | null;
  yearly: number | null;
  desc: string;
  features: string[];
  productId: string;
  popular?: boolean;
};

type SelectAPlanProps = {
  tiers: Tier[];
  seats: number;
  interval: "month" | "year";
  effectivePlan: string;
  onSeatsChange: (seats: number) => void;
  onCheckout: (tier: Tier, interval: "month" | "year") => void;
  loading: boolean;
};

export function SelectAPlan({
  tiers,
  seats,
  interval,
  effectivePlan,
  onSeatsChange,
  onCheckout,
  loading,
}: SelectAPlanProps) {
  const min = tiers[0]?.seatsMin ?? 1;
  const max = tiers[tiers.length - 1]?.seatsMax ?? 14;

  const active = useMemo(
    () => tiers.find((t) => seats >= t.seatsMin && seats <= t.seatsMax) ?? tiers[0],
    [tiers, seats]
  );
  const isCurrent = active?.plan === effectivePlan;

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  return (
    <Card className="mx-auto w-full max-w-xl overflow-hidden">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-lg">Choose the seats</CardTitle>
        <CardDescription>
          We&apos;ll auto-select the plan matching your team size. Prices stay flat —
          no per-seat billing.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="mx-auto flex w-full max-w-60 items-center gap-3">
          <button
            type="button"
            aria-label="Fewer seats"
            onClick={() => onSeatsChange(clamp(seats - 1))}
            disabled={seats <= min}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {seats}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {seats === 1 ? "Seat" : "Seats"}
            </div>
          </div>
          <button
            type="button"
            aria-label="More seats"
            onClick={() => onSeatsChange(clamp(seats + 1))}
            disabled={seats >= max}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="px-1">
          <Slider
            min={min}
            max={max}
            step={1}
            value={seats}
            onChange={(e) => onSeatsChange(clamp(Number(e.target.value)))}
            aria-label="Seats"
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{min} seat{min > 1 ? "s" : ""}</span>
            <span>{max} seats</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {tiers.map((tier) => {
            const activeTier = tier.plan === active?.plan;
            const price = tier.plan === "free" ? 0 : interval === "year" && tier.yearly ? tier.yearly : (tier.monthly ?? 0);
            const per = tier.plan === "free" ? "" : interval === "year" ? "/yr" : "/mo";
            const current = tier.plan === effectivePlan;
            return (
              <div
                key={tier.plan}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                  activeTier
                    ? "border-primary bg-primary/[0.03]"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-foreground">
                        {tier.name}
                      </span>
                      {tier.popular && (
                        <Badge className="gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                          <Sparkles className="h-3 w-3" /> Popular
                        </Badge>
                      )}
                      {current && (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {tier.desc}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                      {tier.plan === "free" ? "Free" : inr(price)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{per}</div>
                  </div>
                </div>

                <div
                  className={cn(
                    "grid grid-cols-1 gap-1.5 overflow-hidden transition-all",
                    activeTier ? "max-h-40" : "max-h-0"
                  )}
                >
                  {tier.features.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-2 text-[12px] text-foreground/80"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      {f}
                    </span>
                  ))}
                </div>

                <Button
                  variant={activeTier ? (tier.popular ? "default" : "outline") : "outline"}
                  disabled={loading || (activeTier && isCurrent)}
                  onClick={() => {
                    if (!activeTier) {
                      onSeatsChange(tier.seatsMin);
                    } else {
                      onCheckout(tier, interval);
                    }
                  }}
                  className="w-full"
                >
                  {loading
                    ? "Redirecting…"
                    : activeTier && isCurrent
                      ? "Current plan"
                      : activeTier
                        ? tier.plan === "enterprise"
                          ? "Contact us"
                          : `Choose ${tier.name}`
                        : `From ${tier.seatsMin} seats`}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}