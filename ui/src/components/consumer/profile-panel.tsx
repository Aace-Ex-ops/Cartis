"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

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
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void gql<ProfileData>(`{ me { fullName email avatarUrl userType } }`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const me = data?.me;

  async function deleteAccount() {
    setDeleting(true);
    try {
      await gql(`mutation { deleteUser }`);
    } catch {
      // user may already be gone — proceed with logout anyway
    }
    try {
      await fetch(`${GATEWAY}/auth/logout`, { redirect: "manual" });
    } catch {
      // fall through — clear the cookie below regardless
    }
    document.cookie = "session=; Max-Age=0; Path=/; Secure; SameSite=Strict";
    window.location.href = "/";
  }

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

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            {confirming
              ? "This permanently deletes your account, all data, and your AI memory. This cannot be undone."
              : "Permanently delete your account and all associated data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void deleteAccount()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete my account"}
              </Button>
            </>
          ) : (
            <Button variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
