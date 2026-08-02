"use client";

import { useEffect, useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMe, type User } from "@/lib/auth";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export function LandingAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void getMe().then(setUser);
  }, []);

  if (user === undefined) return <div className="h-9 w-24" />;

  if (!user) {
    return (
      <a
        href="/signin"
        className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
      >
        Sign in
      </a>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 outline-none focus:ring-1 focus:ring-primary">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-9 w-9 rounded-full border border-border/60 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-foreground">
            {initials}
          </div>
        )}
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
  );
}
