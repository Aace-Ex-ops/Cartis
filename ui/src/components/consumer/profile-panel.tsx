"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void gql<ProfileData>(`{ me { fullName email avatarUrl userType } }`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const me = data?.me;

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    setError("");
    try {
      await gql<{ deleteUser: boolean }>(`mutation { deleteUser }`);
      window.location.href = `${GATEWAY}/auth/logout`;
    } catch {
      setError("Couldn't delete the account — try again.");
      setDeleting(false);
    }
  };

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

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all your data — transactions, budgets,
            chats, and seller records. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!confirming ? (
            <Button
              variant="destructive"
              className="w-fit"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete account
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-muted-foreground">
                Type <span className="font-semibold text-foreground">DELETE</span> to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="max-w-[220px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={confirmText !== "DELETE" || deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
                <Button
                  variant="outline"
                  disabled={deleting}
                  onClick={() => { setConfirming(false); setConfirmText(""); }}
                >
                  Cancel
                </Button>
              </div>
              {error && <p className="text-[13px] text-destructive">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
