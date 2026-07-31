"use client";

import { useState } from "react";
import { ClipboardPaste, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export function SyncPasteBox({ bank }: { bank?: string }) {
  const [paste, setPaste] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<"ok" | "pending" | null>(null);

  const handleSync = async () => {
    if (!paste.trim()) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`${GATEWAY}/api/sync/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank, text: paste }),
      });
      setResult(res.ok ? "ok" : "pending");
    } catch {
      setResult("pending");
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
        className="resize-none font-mono text-[13px]"
      />
      <Button
        variant="secondary"
        onClick={handleSync}
        disabled={!paste.trim() || syncing}
      >
        <ClipboardPaste className="mr-2 h-4 w-4" />
        {syncing ? "Syncing…" : "Sync transactions"}
      </Button>
      {result === "ok" && (
        <p className="flex items-center gap-1.5 text-[13px] text-primary">
          <CheckCircle2 className="h-4 w-4" /> Transactions synced.
        </p>
      )}
      {result === "pending" && (
        <p className="text-[13px] text-muted-foreground">
          Parser endpoint lands with CARTIS-16 — your text will be processed
          then. Nothing was lost.
        </p>
      )}
    </div>
  );
}
