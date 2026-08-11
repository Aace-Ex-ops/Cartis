"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { MetallicLogo } from "@/components/shared/metallic-logo";

const BG_VIDEO = "/landing/videos/header-bg.mp4";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
  { label: "Sign in", href: "/signin" },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const lineReveal = {
  hidden: { y: "120%" },
  visible: { y: 0, transition: { duration: 1.1, ease: EASE } },
};

export function FinanceHeaderAynaz() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="finance-header-aynaz"
      className="relative w-full h-screen min-h-[640px] bg-white text-white overflow-visible"
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          initial={{ scale: 1 }}
          whileInView={{ scale: 1.08 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 24, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
          className="absolute inset-x-0 top-[-18vh] bottom-0 x-fade-top-deep overflow-hidden"
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover select-none"
            src={BG_VIDEO}
            poster="/landing/posters/header-bg.jpg"
          />
        </motion.div>
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-x-0 top-0 h-[18vh] bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 md:px-16 h-20 md:h-24">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer" aria-label="Cartis home">
          <MetallicLogo tone="light" className="h-[18px] w-[46px] md:h-[22px] md:w-[56px]" />
          <span
            className="text-lg sm:text-2xl font-normal text-white uppercase tracking-wider"
            style={{ fontFamily: "var(--font-anybody), sans-serif", lineHeight: "normal" }}
          >
            Cartis
          </span>
        </Link>
        <nav
          className="hidden md:flex items-center"
          style={{ padding: "14px 20px", gap: 24, borderRadius: 12, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
        >
          <ul className="flex items-center gap-[24px] text-sm font-medium">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="cursor-pointer select-none transition-all duration-300 hover:opacity-70"
                  style={{ color: "rgb(255,255,255)", textAlign: "center", fontFamily: "var(--font-anybody), sans-serif" }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href="/signup"
          className="cursor-pointer px-3 py-2 sm:px-6 sm:py-3.5 rounded-lg bg-[#CAACD2] text-[#131D2F] font-semibold transition-all duration-300 hover:bg-[#DCC3E2] active:scale-95"
          style={{ fontFamily: "var(--font-anybody), sans-serif", fontSize: 14, letterSpacing: "0.35px" }}
        >
          Get Started
        </a>
      </header>

      <div className="relative z-20 w-full h-full flex items-end px-4 sm:px-6 md:px-16 pb-20 sm:pb-24 md:pb-28">
        <div className="w-full flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-8">
          <motion.div
            className="w-full md:w-[483px] max-w-full"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ staggerChildren: 0.15 }}
          >
            <h2
              className="text-[24px] sm:text-[44px] md:text-[60px] tracking-tight drop-shadow-lg select-none"
              style={{
                color: "rgb(255,255,255)",
                fontFamily: "var(--font-anybody), sans-serif",
                fontStyle: "italic",
                fontWeight: 300,
                lineHeight: 1.1,
                textTransform: "uppercase",
              }}
            >
              <span className="block overflow-hidden py-1">
                <motion.span className="inline-block" variants={lineReveal}>
                  Your money,
                </motion.span>
              </span>
              <span className="block overflow-hidden py-1">
                <motion.span className="inline-block" variants={lineReveal}>
                  fully under
                </motion.span>
              </span>
              <span className="block overflow-hidden py-1">
                <motion.span className="inline-block" variants={lineReveal}>
                  your control.
                </motion.span>
              </span>
            </h2>
          </motion.div>
          <motion.div
            className="w-full md:w-[460px] max-w-full flex flex-col md:items-end gap-3 md:gap-5"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE }}
          >
            <p
              className="text-[13px] sm:text-[18px] md:text-[22px] text-left md:text-right leading-relaxed md:leading-[30px] max-w-full"
              style={{ color: "rgb(217,234,255)", fontFamily: "var(--font-anybody), sans-serif" }}
            >
              Real-time bank sync, AI-driven insights, and automated savings — built for every
              portfolio.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5">
        <div className="flex flex-col items-center gap-1.5" style={{ opacity: 0.6 }}>
          <span className="text-white/40 uppercase tracking-widest text-[9px] font-semibold">
            Scroll to Explore
          </span>
          <div className="w-1 h-3 bg-[#E8C5C8] rounded-full animate-bounce" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
    </section>
  );
}
