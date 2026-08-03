"use client";

import { useState } from "react";
import { ClipboardPaste, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { gql } from "@/lib/gql";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

type ParsedTx = {
  type: "debit" | "credit";
  amount: number;
  balance?: number;
};

export function SyncPasteBox({
  bank,
  mobile,
  onSynced,
}: {
  bank?: string;
  mobile?: string;
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
        transactions?: ParsedTx[];
        balance?: number | null;
        bank_name?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setMessage({ ok: false, text: `Sync failed: ${body.error ?? "unknown error"}` });
        return;
      }
      const balance =
        body.balance ??
        body.transactions?.[body.transactions.length - 1]?.balance ??
        null;
      if (!body.transactions?.length && balance == null) {
        setMessage({
          ok: false,
          text: "Nothing recognized — paste a bank alert like: Rs.1,250 debited from A/C **1234. Bal: Rs.24,580.",
        });
        return;
      }
      const entries = (body.transactions ?? []).map((t) => ({
        transactionType: t.type,
        amount: t.type === "credit" ? -t.amount : t.amount,
      }));
      const r = await gql<{ addLedgerEntries: { inserted: number; balance: number | null } }>(
        `mutation ($entries: [LedgerEntryInput!]!, $balance: Float, $bankName: String, $mobileNumber: String) {
          addLedgerEntries(entries: $entries, balance: $balance, bankName: $bankName, mobileNumber: $mobileNumber) { inserted balance }
        }`,
        { entries, balance, bankName: body.bank_name ?? (bank || null), mobileNumber: mobile || null },
      );
      const inserted = r.addLedgerEntries.inserted;
      setMessage({
        ok: true,
        text:
          inserted === 0 && balance != null
            ? `Balance updated to ₹${balance.toLocaleString("en-IN")}.`
            : inserted === 0
              ? "0 new — already synced."
              : `${inserted} transaction${inserted > 1 ? "s" : ""} synced${r.addLedgerEntries.balance != null ? ` · balance ₹${r.addLedgerEntries.balance.toLocaleString("en-IN")}` : ""}.`,
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
        {syncing ? "Syncing…" : "Sync transactions"}
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
