"use client";

import { useEffect, useState } from "react";
import { getMe, type User } from "@/lib/auth";

export function AuthAwareCta({
  label = "Get started free",
  loggedInLabel = "Go to dashboard",
  className,
}: {
  label?: string;
  loggedInLabel?: string;
  className?: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void getMe().then(setUser);
  }, []);

  return (
    <a href={user ? "/dashboard" : "/signup"} className={className}>
      {user ? loggedInLabel : label}
    </a>
  );
}
