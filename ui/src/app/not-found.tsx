"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Warp } from "@paper-design/shaders-react";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden p-6 text-white">
      {/* Background Warp Shader - Landing Page Palette */}
      <div aria-hidden className="fixed inset-0 z-0">
        <Warp
          style={{ height: "100%", width: "100%" }}
          proportion={0.45}
          softness={1}
          distortion={0.25}
          swirl={0.8}
          swirlIterations={10}
          shape="checks"
          shapeScale={0.1}
          scale={1}
          rotation={0}
          speed={0.8}
          colors={[
            "hsl(200, 100%, 20%)",
            "hsl(160, 100%, 75%)",
            "hsl(180, 90%, 30%)",
            "hsl(170, 100%, 80%)",
          ]}
        />
      </div>

      {/* Brand Header */}
      <header className="absolute top-6 left-6 md:top-8 md:left-10 z-20">
        <Link href="/" className="group flex items-center gap-3 transition-transform duration-300 hover:scale-105">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/40 bg-gradient-to-br from-teal-400/25 via-emerald-500/15 to-black/60 shadow-[0_0_16px_-3px_rgba(45,212,191,0.4)] backdrop-blur-md">
            <span className="text-lg font-black text-teal-100 drop-shadow-[0_0_8px_rgba(45,212,191,0.9)]">
              C
            </span>
          </div>
          <MetallicLogo className="h-[32px] w-[110px]" />
        </Link>
      </header>

      {/* Main Glass Card Container */}
      <main className="relative z-10 mx-auto w-full max-w-lg text-center">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/20 bg-black/45 p-8 shadow-[0_0_90px_-15px_rgba(45,212,191,0.3)] backdrop-blur-2xl sm:p-12"
        >
          {/* Subtle top indicator chip */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-teal-300/40 bg-teal-300/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.2)]">
            <AlertTriangle className="h-3.5 w-3.5 text-teal-300" />
            <span>404 Error</span>
          </div>

          {/* Glowing 404 Headline */}
          <div className="relative select-none">
            <h1 className="text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-teal-100 to-teal-400/80 drop-shadow-[0_0_35px_rgba(45,212,191,0.6)] sm:text-9xl">
              404
            </h1>
            <div className="absolute inset-0 bg-teal-300/10 blur-3xl rounded-full scale-75 pointer-events-none" />
          </div>

          <h2 className="mt-4 text-2xl font-light tracking-tight text-white sm:text-3xl">
            Lost in the ledger?
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/75">
            The page or purchase verdict you&apos;re looking for doesn&apos;t exist, was moved, or has expired.
          </p>

          {/* Action Button - Only Return to Home per prompt request */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="group relative flex items-center justify-center gap-2.5 rounded-2xl bg-white px-7 py-3.5 text-sm font-semibold text-gray-900 shadow-xl transition-all duration-300 hover:scale-105 hover:bg-teal-200 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
              <span>Return to Home</span>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer System Status */}
      <footer className="absolute bottom-6 z-20 text-center text-xs font-light text-white/50">
        &copy; {new Date().getFullYear()} Cartis Inc. · All systems operational
      </footer>
    </div>
  );
}
