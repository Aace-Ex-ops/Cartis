"use client";

import { CartisHelloEffect } from "@/components/ui/apple-hello-effect";

export function MetallicLogo({
  className = "",
  tone = "ui",
}: {
  className?: string;
  tone?: "ui" | "light";
}) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <CartisHelloEffect
        tone={tone}
        className={`h-full w-full ${tone === "light" ? "stroke-white text-white" : "stroke-foreground text-foreground"}`}
        speed={1.2}
      />
    </div>
  );
}
