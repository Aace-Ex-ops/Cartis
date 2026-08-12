"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CartisHelloEffect } from "@/components/ui/apple-hello-effect";

const TOTAL = 2200;
const FADE = 400;

export function Preloader() {
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setMounted(true));

    const t = setTimeout(() => {
      setDone(true);
      document.body.style.overflow = "";
      setTimeout(() => setRemoved(true), FADE);
    }, TOTAL);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted || removed) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background"
          exit={{ opacity: 0 }}
          transition={{ duration: FADE / 1000, ease: "easeOut" }}
          onAnimationComplete={() => {
            document.body.style.overflow = "";
          }}
        >
          <CartisHelloEffect className="h-20 w-[208px]" speed={1.5} />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="font-sans text-sm tracking-[0.2em] text-muted-foreground/60 uppercase"
          >
            AI Financial Coach
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
