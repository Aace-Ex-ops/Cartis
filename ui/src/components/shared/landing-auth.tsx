"use client";

import { useEffect, useState } from "react";
import { getMe, type User } from "@/lib/auth";

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
    <div className="flex items-center gap-2.5">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Go to dashboard
      </a>
      <a href="/dashboard" className="rounded-full outline-none focus:ring-1 focus:ring-primary">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-9 w-9 rounded-full border border-border/60 object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-foreground">
            {initials}
          </div>
        )}
      </a>
    </div>
  );
}
