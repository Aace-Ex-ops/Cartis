"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { History, X } from "lucide-react";
import { TwinChat } from "@/components/shared/twin-chat";
import { gql } from "@/lib/gql";

export function TwinDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [userType, setUserType] = useState<string | null>(null);
  const mode = userType === "business" || userType === "seller" ? "seller" : undefined;
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void gql<{ me?: { userType?: string } | null }>("{ me { userType } }")
      .then((d) => {
        if (!cancelled) setUserType(d.me?.userType ?? "personal");
      })
      .catch(() => {
        if (!cancelled) setUserType("personal");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-[520px] max-w-[94vw] flex-col border-l border-border/50 bg-card"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", duration: 0.4 }}
          >
            <div className="grid shrink-0 grid-cols-[36px_1fr_36px] items-center border-b border-border/50 px-3 py-2.5">
              <button
                onClick={() => setRailOpen((v) => !v)}
                className={`justify-self-start rounded-md p-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground ${
                  railOpen ? "text-foreground" : "text-muted-foreground"
                }`}
                aria-label="Toggle chat history"
              >
                <History className="h-4 w-4" />
              </button>
              <span className="text-center text-sm font-semibold text-foreground">AI Twin</span>
              <button
                onClick={onClose}
                className="justify-self-end rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                aria-label="Close AI Twin"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <TwinChat
                mode={mode}
                railOpen={railOpen}
                tools={
                  mode === "seller"
                    ? undefined
                    : [
                        { id: "budget", label: "Budget" },
                        { id: "retirement", label: "Retirement" },
                        { id: "tax", label: "Tax" },
                        { id: "stock", label: "Stocks" },
                      ]
                }
                title="AI Twin"
                welcome="Hi, I'm your AI twin. Ask me about your spending, budget, savings, or business numbers."
                placeholder="Ask anything…"
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
