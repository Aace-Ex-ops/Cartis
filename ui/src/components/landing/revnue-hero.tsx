"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AuthAwareLink } from "@/components/shared/auth-aware-link";

const CHAIR_URL =
  "https://cdn.jiro.build/Jahid/Random/RevNue/All%20Images/chair.png";
const HEADER_BG_URL =
  "https://cdn.jiro.build/Jahid/Random/RevNue/All%20Images/header%20bg%20revnue.mp4";

export function RevnueHero() {
  const [e, setE] = useState(0);
  const [o, setO] = useState(0);
  const [fit, setFit] = useState<"contain" | "cover">("cover");
  const [imgOk, setImgOk] = useState(true);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById("header-root-container");
      if (!el) return;
      const top = -el.getBoundingClientRect().top;
      const denom = 0.8 * (el.offsetHeight - window.innerHeight);
      setE(denom > 0 ? Math.min(Math.max(top / denom, 0), 1) : 0);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ratio = 16 / 9;
      const contain = w / h >= ratio;
      setFit(contain ? "contain" : "cover");
      setO(contain ? (w / ratio - h) * (0.6222 - 0.5) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div id="header-root-container" className="relative w-full min-h-[220vh] bg-white">
      <section
        id="header-section"
        className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-center"
      >
        {videoOk && (
          <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
            <video
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoOk(false)}
              className="w-full h-full object-cover select-none"
              src={HEADER_BG_URL}
            />
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
          </div>
        )}

        {imgOk && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none overflow-hidden">
            <motion.img
              src={CHAIR_URL}
              alt="Astronaut sitting on a hill"
              onError={() => setImgOk(false)}
              initial={{ scale: 4.2, opacity: 0 }}
              animate={{ scale: 4 - 3 * e, y: o * e, opacity: 1 }}
              transition={{
                scale: { duration: 0.1, ease: "easeOut" },
                y: { duration: 0.1, ease: "easeOut" },
                opacity: { duration: 1.5, ease: "easeOut" },
              }}
              style={{ objectFit: fit }}
              className="w-full h-full select-none"
            />
          </div>
        )}

        <div className="relative z-20 w-full text-center bg-black/25 backdrop-blur-[1px] rounded-[32px] py-10 md:py-12 px-4 sm:px-8 md:px-12 xl:px-16">
          <div className="overflow-hidden py-4">
            <motion.h1
              initial={{ y: 150, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              className="relative select-none text-white text-center font-inclusive text-[40px] sm:text-[52px] md:text-[72px] lg:text-[96px] font-medium leading-[114%] tracking-[-2px] sm:tracking-[-4px] md:tracking-[-6px] lg:tracking-[-8px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
            >
              <motion.span
                className="inline-block"
                animate={{ x: [-8, 8, -8], y: [8, -8, 8] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              >
                See the future of your money.
              </motion.span>
            </motion.h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-4 flex max-w-2xl flex-col items-center gap-5"
          >
            <p className="font-gantari text-lg text-white/85 md:text-xl">
              Cartis reads your real money — wallet, budget, spending pace, business health — and
              tells you what to do before every financial decision.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <AuthAwareLink
                href="/signup"
                signedInLabel="Go to dashboard"
                className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-[#0C0C0C] shadow-lg transition-colors hover:bg-[#F5F5F5]"
              >
                <span className="font-gantari text-lg font-medium tracking-tight">Get started free</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0C0C0C] text-white transition-transform duration-300 group-hover:translate-x-0.5">
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                    <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </AuthAwareLink>
              <a
                href="#features"
                className="inline-flex items-center gap-3 rounded-full border border-white/40 bg-white/10 px-6 py-3 font-gantari text-lg font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                How it works
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
