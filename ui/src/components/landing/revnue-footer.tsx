"use client";

import { motion } from "motion/react";
import { Mail, Phone, MapPin } from "lucide-react";
import { RevnueBrand } from "./revnue-brand";

const PRODUCT = [
  { label: "Overview", href: "/" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "/signup" },
  { label: "FAQ", href: "#faq" },
];

const RESOURCES = [
  { label: "Sign in", href: "/signin" },
  { label: "Create account", href: "/signup" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Privacy", href: "/privacy" },
];

export function RevnueFooter() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          initial={{ opacity: 0.2, y: 80 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="bg-gradient-to-b from-[#0C0C0C] to-[rgba(12,12,12,0.20)] bg-clip-text text-center font-inclusive text-[28px] sm:text-[44px] font-medium leading-[1.02] tracking-[-1.5px] sm:tracking-[-3px] text-transparent md:text-8xl md:tracking-[-6px] lg:text-[120px]"
        >
          Full control of your financial operations
        </motion.h2>

        <div className="mt-16 overflow-hidden rounded-[24px] bg-[#0C0C0C] px-8 py-12 text-white md:px-16 md:py-16">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
            <div>
              <RevnueBrand tone="light" />
              <p className="mt-5 max-w-xs font-gantari text-[15px] leading-relaxed text-[rgba(255,255,255,0.70)]">
                Streamline accounting, optimize cash flow, and make smarter financial decisions with
                one platform.
              </p>
            </div>

            <div>
              <p className="font-gantari text-sm uppercase tracking-widest text-white/50">Product</p>
              <ul className="mt-5 space-y-3">
                {PRODUCT.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="font-gantari text-[15px] text-white/80 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-gantari text-sm uppercase tracking-widest text-white/50">Get started</p>
              <ul className="mt-5 space-y-3">
                {RESOURCES.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="font-gantari text-[15px] text-white/80 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-gantari text-sm uppercase tracking-widest text-white/50">Contact</p>
              <ul className="mt-5 space-y-4">
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-white/60" />
                  <a href="mailto:support@cartis.app" className="font-gantari text-[15px] text-white/80 hover:text-white">
                    support@cartis.app
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-white/60" />
                  <span className="font-gantari text-[15px] text-white/80">+91 00000 00000</span>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-white/60" />
                  <span className="font-gantari text-[15px] text-white/80">Bengaluru, India</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 h-px bg-white/20" />
          <div className="mt-6 flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="font-gantari text-sm text-white/50">©2026 Cartis Inc. All rights reserved.</p>
            <p className="font-gantari text-sm text-white/50">
              AI Financial Coach · <span className="italic">built for India</span>
            </p>
          </div>
        </div>

        <div className="pointer-events-none select-none overflow-hidden text-center">
          <span className="font-inclusive text-[16vw] sm:text-[22vw] font-medium leading-[0.9] tracking-[-0.04em] text-[#0C0C0C] opacity-[0.03]">
            CARTIS
          </span>
        </div>
      </div>
    </section>
  );
}
