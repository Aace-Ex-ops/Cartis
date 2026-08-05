"use client";

import { useState } from "react";
import { Banknote, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type ConsentStatus = "PENDING" | "ACTIVE" | "REJECTED" | "DATA_RECEIVED" | null;

export function SetuConnect({
  onSynced,
  mode = "wallet",
}: {
  onSynced?: () => void;
  mode?: "onboarding" | "wallet";
}) {
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState<"idle" | "consent" | "polling" | "done">("idle");
  const [consentId, setConsentId] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    const num = mobile.replace(/\D/g, "");
    if (num.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setError(null);
    setStep("consent");

    try {
      const res = await fetch(`${GATEWAY}/api/setu/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: num }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to start bank sync");
        setStep("idle");
        return;
      }
      setConsentId(body.id);
      setConsentUrl(body.url);
      setStep("polling");
      pollConsent(body.id);
    } catch {
      setError("Network error — try again");
      setStep("idle");
    }
  };

  const pollConsent = async (id: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`${GATEWAY}/api/setu/consent/${id}`, {
          credentials: "include",
        });
        if (!res.ok) continue;
        const body = await res.json();
        const status: ConsentStatus = body.status;
        if (status === "ACTIVE" || status === "DATA_RECEIVED") {
          setStep("done");
          onSynced?.();
          return;
        }
        if (status === "REJECTED") {
          setError("Consent was rejected — try again");
          setStep("idle");
          return;
        }
      } catch {
        // retry
      }
    }
    setError("Timed out waiting for approval — check your bank app");
    setStep("idle");
  };

  if (step === "done") {
    return (
      <div className="flex items-center gap-2 text-emerald-600 text-sm py-3">
        <CheckCircle2 className="w-4 h-4" />
        Bank connected — transactions synced
      </div>
    );
  }

  if (step === "polling" && consentUrl) {
    return (
      <div className="space-y-3 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for bank approval…
        </div>
        <a
          href={consentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          Open bank consent page <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <p className="text-xs text-muted-foreground">
          Approve in your bank app, then we&apos;ll sync automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Banknote className="w-4 h-4" />
        Connect your bank account
      </div>
      <p className="text-xs text-muted-foreground">
        We&apos;ll fetch your transactions securely via Account Aggregator (Setu AA).
      </p>
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="10-digit mobile number"
          value={mobile}
          onChange={(e) => {
            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
            setError(null);
          }}
          maxLength={10}
          className="flex-1"
        />
        <Button
          onClick={handleConnect}
          disabled={mobile.replace(/\D/g, "").length !== 10 || step === "consent"}
          size="sm"
        >
          {step === "consent" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Connect"
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
