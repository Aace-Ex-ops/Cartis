"use client";

import { PremiumAuth } from "@/components/ui/premium-auth";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  return <PremiumAuth defaultMode={mode} />;
}
