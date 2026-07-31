"use client";

import { useState } from "react";
import { Search, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertBell } from "@/components/shared/alert-bell";

const GATEWAY =
  process.env.NEXT_PUBLIC_GATEWAY_URL ??
  "https://cartis-gateway.rz8m4crnwt.workers.dev";

export function HeaderBar({
  user,
  alerts = [],
  leading,
}: {
  user?: { name: string; email: string };
  alerts?: { id: string; title: string; time: string }[];
  leading?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const initials = (user?.name ?? "C")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-card px-4">
      {leading}
      <div className="relative hidden w-64 md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions, purchases…"
          className="w-full rounded-md border border-border/50 bg-background/50 py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <AlertBell alerts={alerts} />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 outline-none focus:ring-1 focus:ring-primary">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-foreground">
                {initials}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium">{user.name}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={`${GATEWAY}/auth/logout`}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
