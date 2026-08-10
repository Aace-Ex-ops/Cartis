"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type ConnectStep = "input" | "redirecting" | "polling" | "fetching" | "done" | "error";

export function AaConnect({ onSynced }: { onSynced?: () => void }) {
  const [step, setStep] = useState<ConnectStep>("input");
  const [error, setError] = useState("");
  const [consentId] = useState("linked");

  // Returning from the FastLink flow (callback URL has ?linked=1)
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked") === "1") {
      queueMicrotask(() => setStep("polling"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Poll status when in polling step
  const pollConsent = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`${GATEWAY}/api/aa/status/${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      const body = (await res.json()) as { consentStatus?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Failed to check connection status");
        setStep("error");
        return;
      }
      if (body.consentStatus === "ACTIVE") {
        // Linked — fetch data
        setStep("fetching");
        const fetchRes = await fetch(`${GATEWAY}/api/aa/fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ consentId: cid }),
        });
        const fetchBody = (await fetchRes.json()) as {
          ok?: boolean;
          balance?: number;
          transactionCount?: number;
          error?: string;
        };
        if (!fetchRes.ok || !fetchBody.ok) {
          setError(fetchBody.error ?? "Failed to fetch data");
          setStep("error");
          return;
        }
        setStep("done");
        onSynced?.();
      }
      // else still linking — continue polling
    } catch {
      setError("Network error — try again");
      setStep("error");
    }
  }, [onSynced]);

  useEffect(() => {
    if (step !== "polling" || !consentId) return;
    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      await pollConsent(consentId);
    }, 3000);
    return () => { stopped = true; clearInterval(interval); };
  }, [step, consentId, pollConsent]);

  async function connect() {
    setStep("redirecting");
    setError("");

    try {
      // FastLink redirects back here with ?linked=1
      const cb = `${window.location.origin}${window.location.pathname}?linked=1`;
      const consentRes = await fetch(`${GATEWAY}/api/aa/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ redirectUrl: cb }),
      });
      const body = (await consentRes.json()) as { linkUrl?: string; error?: string };
      if (!consentRes.ok || !body.linkUrl) {
        setError(body.error ?? "Failed to start bank link");
        setStep("error");
        return;
      }

      window.location.href = body.linkUrl;
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

  if (step === "redirecting") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Opening secure bank link…</p>
        <p className="text-[13px] text-muted-foreground">
          You&apos;ll sign in to your bank and approve data sharing
        </p>
      </div>
    );
  }

  if (step === "polling") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Waiting for link…</p>
        <p className="text-[13px] text-muted-foreground">
          Complete the bank sign-in in the other window, then come back here
        </p>
      </div>
    );
  }

  if (step === "fetching") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Fetching your data…</p>
        <p className="text-[13px] text-muted-foreground">
          Pulling transactions from your bank
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
        Securely link your bank account to pull balances and transactions into Cartis.
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
      const body = (await res.json()) as { ok?: boolean; balance?: number; transactionCount?: number; error?: string };
      if (!res.ok || !body.ok) {
        setResult({ ok: false, message: body.error ?? "Re-sync failed" });
      } else {
        setResult({ ok: true, message: `Synced ${body.transactionCount ?? 0} transactions · balance ₹${(body.balance ?? 0).toLocaleString("en-IN")}` });
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
