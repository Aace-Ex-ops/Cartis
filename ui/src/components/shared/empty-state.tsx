"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { ArrowLeft } from "lucide-react";

export function EmptyState({
  icon,
  badge,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="flex items-center gap-3 px-6 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <MetallicLogo className="h-8 w-auto" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            {icon}
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            {badge}
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          {cta && (
            <Button asChild className="mt-8" size="lg">
              <Link href={cta.href}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {cta.label}
              </Link>
            </Button>
          )}
        </div>
      </main>
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Cartis Inc.
      </footer>
    </div>
  );
}
