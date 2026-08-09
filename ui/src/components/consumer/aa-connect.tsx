"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type ConnectStep = "input" | "redirecting" | "polling" | "fetching" | "done" | "error";

export function AaConnect({ onSynced }: { onSynced?: () => void }) {
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState<ConnectStep>("input");
  const [error, setError] = useState("");
  const [consentId, setConsentId] = useState("");

  // Check for consentId in URL on mount (returning from Setu redirect)
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const syncFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlConsentId = params.get("consentId");
      if (urlConsentId) {
        setConsentId(urlConsentId);
        setStep("polling");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    };
    void syncFromUrl();
  }, []);

  // Poll consent status when in polling step
  const pollConsent = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`${GATEWAY}/api/aa/status/${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      const body = (await res.json()) as { consentStatus?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Failed to check consent status");
        setStep("error");
        return;
      }
      if (body.consentStatus === "ACTIVE" || body.consentStatus === "ACTIVE") {
        // Consent approved — fetch data
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
      // else still PENDING — continue polling
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
    if (!mobile || !/^\d{10}$/.test(mobile)) return;
    setStep("redirecting");
    setError("");

    try {
      const consentRes = await fetch(`${GATEWAY}/api/aa/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobileNumber: mobile }),
      });
      const body = (await consentRes.json()) as { consentId?: string; consentUrl?: string; error?: string };
      if (!consentRes.ok || !body.consentId || !body.consentUrl) {
        setError(body.error ?? "Failed to create consent");
        setStep("error");
        return;
      }

      // Store consentId and redirect to Setu consent webview
      localStorage.setItem("aa_consent_id", body.consentId);
      window.location.href = body.consentUrl;
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
        <p className="text-sm font-medium text-foreground">Redirecting to consent…</p>
        <p className="text-[13px] text-muted-foreground">
          You&apos;ll verify your identity and approve data sharing
        </p>
      </div>
    );
  }

  if (step === "polling") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Waiting for approval…</p>
        <p className="text-[13px] text-muted-foreground">
          Approve the consent on the Setu screen, then come back here        </p>
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
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-foreground">
          Mobile number linked to your bank
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="tel"
            placeholder="9876543210"
            maxLength={10}
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <Button onClick={connect} disabled={mobile.length !== 10} className="w-full">
        <Link2 className="mr-2 h-4 w-4" />
        Connect via AA
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
        Enter your bank-registered mobile number. You&apos;ll be redirected to approve data sharing via Account Aggregator.
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
