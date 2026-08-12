"use client";

import { useState } from "react";
import { Link2, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type ConnectStep = "input" | "fetching" | "done" | "error";

// Direct sync via /api/aa/reconnect (no FastLink popup) — pulls the shared
// sandbox accounts into Cartis. Fresh FastLink links are Yodlee-sandbox-blocked.
export function AaConnect({ onSynced }: { onSynced?: () => void }) {
  const [step, setStep] = useState<ConnectStep>("input");
  const [error, setError] = useState("");

  async function connect() {
    setStep("fetching");
    setError("");
    try {
      const res = await fetch(`${GATEWAY}/api/aa/reconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Failed to sync bank data");
        setStep("error");
        return;
      }
      setStep("done");
      onSynced?.();
    } catch {
      setError("Network error — try again");
      setStep("error");
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-medium text-foreground">Account connected!</p>
        <p className="text-[13px] text-muted-foreground">
          Your bank data is now synced.
        </p>
      </div>
    );
  }

  if (step === "fetching") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Syncing your bank data…</p>
        <p className="text-[13px] text-muted-foreground">
          Pulling balances and transactions from your bank
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={connect} className="w-full">
        <Link2 className="mr-2 h-4 w-4" />
        Connect your bank account
      </Button>

      {step === "error" && error && (
        <p className="flex items-center gap-1.5 text-[13px] text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => { setStep("input"); setError(""); }}>
            Retry
          </Button>
        </p>
      )}

      <p className="text-[12px] text-muted-foreground">
        Securely sync your bank data into Cartis.
      </p>
    </div>
  );
}

export function AaReconnect({ onSynced }: { onSynced?: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function reconnect() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`${GATEWAY}/api/aa/reconnect`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean; balance?: number; transactionCount?: number; incomeCount?: number; error?: string };
      if (!res.ok || !body.ok) {
        setResult({ ok: false, message: body.error ?? "Re-sync failed" });
      } else {
        setResult({ ok: true, message: `Synced ${body.transactionCount ?? 0} transactions · ${body.incomeCount ?? 0} income streams · balance ₹${(body.balance ?? 0).toLocaleString("en-IN")}` });
        onSynced?.();
      }
    } catch {
      setResult({ ok: false, message: "Network error" });
    }
    setSyncing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" onClick={reconnect} disabled={syncing}>
        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : "Re-sync via AA"}
      </Button>
      {result && (
        <p className={`text-[13px] ${result.ok ? "text-green-600" : "text-destructive"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

export function AaLinkRest({ onSynced }: { onSynced?: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function link() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`${GATEWAY}/api/aa/link-rest`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean; balance?: number; transactionCount?: number; incomeCount?: number; error?: string };
      if (!res.ok || !body.ok) {
        setResult({ ok: false, message: body.error ?? "Link failed" });
      } else {
        setResult({ ok: true, message: `New account linked · synced ${body.transactionCount ?? 0} transactions · ${body.incomeCount ?? 0} income streams · balance ₹${(body.balance ?? 0).toLocaleString("en-IN")}` });
        onSynced?.();
      }
    } catch {
      setResult({ ok: false, message: "Network error" });
    }
    setSyncing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" onClick={link} disabled={syncing}>
        <Link2 className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Linking… up to 2 min" : "Link Dag Site (REST)"}
      </Button>
      {result && (
        <p className={`text-[13px] ${result.ok ? "text-green-600" : "text-destructive"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
