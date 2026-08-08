"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { TwinChat } from "@/components/shared/twin-chat";

export function TwinDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const mode = pathname?.startsWith("/seller") ? "seller" : undefined;

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
            className="fixed right-0 top-0 z-50 flex h-full w-[400px] max-w-[92vw] flex-col border-l border-border/50 bg-card"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", duration: 0.4 }}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">AI Twin</span>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                aria-label="Close AI Twin"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TwinChat
                mode={mode}
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
                subtitle="Your financial twin — ask about your money, budget, or business."
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
