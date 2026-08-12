"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "@studio-freight/lenis";

const APP_ROUTES = ["/dashboard", "/onboarding", "/seller"];

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const isAppRoute = APP_ROUTES.some((r) => pathname.startsWith(r));

    if (isAppRoute) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
      return;
    }

    if (!lenisRef.current) {
      const lenis = new Lenis({
        duration: 1.5,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.6,
      });
      lenisRef.current = lenis;

      let animationFrameId: number;
      function raf(time: number) {
        if (lenisRef.current) {
          lenisRef.current.raf(time);
          animationFrameId = requestAnimationFrame(raf);
        }
      }
      animationFrameId = requestAnimationFrame(raf);

      return () => {
        cancelAnimationFrame(animationFrameId);
        if (lenisRef.current) {
          lenisRef.current.destroy();
          lenisRef.current = null;
        }
      };
    }
  }, [pathname]);

  useEffect(() => {
    if (!lenisRef.current) return;
    lenisRef.current.scrollTo(0, { immediate: true });
    lenisRef.current.resize();
  }, [pathname]);

  return <>{children}</>;
}
