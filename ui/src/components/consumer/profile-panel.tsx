"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gql } from "@/lib/gql";

type ProfileData = {
  me: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    userType: string;
  };
};

export function ProfilePanel() {
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<ProfileData>(`{ me { fullName email avatarUrl userType } }`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const me = data?.me;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Personal details</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-lg font-semibold text-foreground">
            {me?.fullName?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "…"}
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-medium text-foreground">{me?.fullName ?? "…"}</span>
            <span className="text-[13px] text-muted-foreground">{me?.email ?? ""}</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground/60 capitalize">{me?.userType ?? ""}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
