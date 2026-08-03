"use client";

import { CartisHelloEffect } from "@/components/ui/apple-hello-effect";

export function MetallicLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <CartisHelloEffect className="h-full w-full stroke-teal-200 text-teal-300" speed={1.2} />
    </div>
  );
}
