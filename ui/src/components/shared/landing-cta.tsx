"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, type User } from "@/lib/auth";
import SpecularButton from "@/components/shared/specular-button";

export function LandingCta() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    void getMe().then(setUser);
  }, []);

  if (user === undefined) return <div className="h-11 w-44" />;

  return (
    <SpecularButton
      size="sm"
      tint="#ffffff"
      lineColor="#ffffff"
      baseColor="#525252"
      intensity={1}
      thickness={1}
      speed={0.35}
      proximity={250}
      autoAnimate={false}
      onClick={() => router.push(user ? "/dashboard" : "/signup")}
    >
      {user ? "Go to dashboard" : "Get started free"}
    </SpecularButton>
  );
}
