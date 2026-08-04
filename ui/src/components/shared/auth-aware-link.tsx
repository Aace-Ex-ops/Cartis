"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, type User } from "@/lib/auth";

export function AuthAwareLink({
  href,
  className,
  children,
  signedInLabel,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  signedInLabel?: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    void getMe().then(setUser);
  }, []);

  const target = user ? "/dashboard" : href;

  return (
    <a
      href={target}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        router.push(target);
      }}
    >
      {user && signedInLabel ? signedInLabel : children}
    </a>
  );
}
