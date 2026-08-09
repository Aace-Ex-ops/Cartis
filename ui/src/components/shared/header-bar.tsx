"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Search } from "lucide-react";
import { AlertBell } from "@/components/shared/alert-bell";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { TwinDrawer } from "@/components/shared/twin-drawer";

export function HeaderBar({
  alerts = [],
  leading,
}: {
  alerts?: { id: string; title: string; time: string }[];
  leading?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [twinOpen, setTwinOpen] = useState(false);

  return (
    <header className="grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/50 bg-card px-4">
      <div className="flex items-center gap-3">
        {leading}
        <Link href="/" aria-label="Cartis home" title="Cartis" onClick={() => window.scrollTo({ top: 0 })}>
          <MetallicLogo className="h-7 w-24" />
        </Link>
      </div>
      <div className="relative hidden w-64 justify-self-center md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions, purchases…"
          className="w-full rounded-lg border border-border/50 bg-background/50 py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTwinOpen(true)}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label="Open AI Twin"
          title="AI Twin"
        >
          <Bot className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
        <AlertBell alerts={alerts} />
      </div>

      <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
    </header>
  );
}
