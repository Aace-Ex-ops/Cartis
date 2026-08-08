"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";

export function RevnueButton({
  href,
  children,
  dark = true,
  className = "",
  arrow = "right",
}: {
  href: string;
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
  arrow?: "right" | "up";
}) {
  const Icon = arrow === "up" ? ArrowUpRight : ArrowRight;
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-4 rounded-full px-6 py-3 transition-colors ${
        dark
          ? "bg-[#0C0C0C] text-white hover:bg-[#252525]"
          : "border border-[#0C0C0C]/5 bg-white text-[#0C0C0C] hover:bg-[#F9F9F9] hover:shadow-xl"
      } ${className}`}
    >
      <span className="font-gantari text-lg font-medium tracking-tight">{children}</span>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-0.5 ${
          dark ? "bg-white text-[#0C0C0C]" : "bg-[#0C0C0C] text-white"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
    </a>
  );
}
