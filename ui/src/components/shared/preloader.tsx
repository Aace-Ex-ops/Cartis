"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CartisHelloEffect } from "@/components/ui/apple-hello-effect";

const TOTAL = 1200;
const FADE = 500;

export function Preloader() {
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setMounted(true));
    const t = setTimeout(() => {
      document.body.style.overflow = "";
      setDone(true);
    }, TOTAL);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background"
          exit={{ opacity: 0 }}
          transition={{ duration: FADE / 1000, ease: "easeOut" }}
        >
          <CartisHelloEffect className="h-20 w-[208px]" speed={1.5} />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="font-sans text-sm tracking-[0.2em] text-muted-foreground/60 uppercase"
          >
            AI Financial Coach
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
