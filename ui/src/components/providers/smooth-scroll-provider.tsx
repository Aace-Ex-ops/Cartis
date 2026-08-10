"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Lenis from "@studio-freight/lenis";

const LenisContext = createContext<Lenis | null>(null);
export function useLenis() { return useContext(LenisContext); }

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const l = new Lenis({
      duration: 1.5,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
    });
    lenisRef.current = l;
    setTick((n) => n + 1); // eslint-disable-line react-hooks/set-state-in-effect -- notify context consumers

    let animationFrameId: number;
    function raf(time: number) {
      l.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      l.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!lenisRef.current) return;
    lenisRef.current.scrollTo(0, { immediate: true });
    lenisRef.current.resize();
  }, [pathname]);

  // eslint-disable-next-line react-hooks/refs -- lenisRef.current is set in useEffect above, stable after mount
  return <LenisContext.Provider value={lenisRef.current}>{children}</LenisContext.Provider>;
}
