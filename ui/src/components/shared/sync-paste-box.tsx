"use client";

import { useState } from "react";
import { ClipboardPaste, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export function SyncPasteBox({
  bank,
  onSynced,
}: {
  bank?: string;
  onSynced?: () => void;
}) {
  const [paste, setPaste] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSync = async () => {
    if (!paste.trim()) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`${GATEWAY}/api/sync/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank, text: paste }),
      });
      const body = (await res.json()) as {
        balance?: number | null;
        bank_name?: string | null;
        error?: string;
        note?: string;
      };
      if (!res.ok) {
        setMessage({ ok: false, text: `Sync failed: ${body.error ?? "unknown error"}` });
        return;
      }
      if (body.balance == null) {
        setMessage({
          ok: false,
          text:
            body.note ??
            "No balance recognized — paste a bank alert like: Bal: Rs.24,580.",
        });
        return;
      }
      await gql<{ addLedgerEntries: { inserted: number; balance: number | null } }>(
        `mutation ($entries: [LedgerEntryInput!]!, $balance: Float, $bankName: String) {
          addLedgerEntries(entries: $entries, balance: $balance, bankName: $bankName) { inserted balance }
        }`,
        { entries: [], balance: body.balance, bankName: body.bank_name ?? (bank || null) },
      );
      setMessage({
        ok: true,
        text: `Balance updated to ₹${body.balance.toLocaleString("en-IN")}.`,
      });
      onSynced?.();
    } catch {
      setMessage({ ok: false, text: "Sync failed — try again." });
    }
    setSyncing(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        rows={5}
        placeholder={"Paste your bank SMS alerts here, e.g.\n\nHDFC Bank: Rs.1,250 debited from A/C **1234 on 12-Jun. UPI: 4012xxxxxx. Bal: Rs.24,580."}
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        className="h-28 max-h-28 resize-none overflow-y-auto font-mono text-[13px]"
      />
      <Button
        variant="secondary"
        onClick={handleSync}
        disabled={!paste.trim() || syncing}
      >
        <ClipboardPaste className="mr-2 h-4 w-4" />
        {syncing ? "Syncing…" : "Sync balance"}
      </Button>
      {message && (
        <p
          className={`flex items-center gap-1.5 text-[13px] ${
            message.ok ? "text-primary" : "text-destructive"
          }`}
        >
          {message.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {message.text}
        </p>
      )}
    </div>
  );
}
