"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { getMe, type User } from "@/lib/auth";

export function LandingCta() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void getMe().then(setUser);
  }, []);

  if (user === undefined) return <div className="h-11 w-44" />;

  return (
    <a
      href={user ? "/dashboard" : "/signup"}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      {user ? "Go to dashboard" : "Get started free"}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}
