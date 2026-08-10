"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { RevnueBrand } from "./revnue-brand";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

export function RevnueNav() {
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50"
      style={{ paddingTop: 20 }}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-0">
        <div className="flex items-center gap-6">
          <RevnueBrand />
          <ul className="hidden items-center gap-1 rounded-full border border-[rgba(12,12,12,0.02)] bg-[rgba(12,12,12,0.02)] px-2 py-1.5 backdrop-blur-md lg:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-4 py-2 font-gantari text-[15px] text-[rgba(12,12,12,0.70)] transition-colors hover:bg-white hover:text-[#0C0C0C]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-[rgba(12,12,12,0.02)] bg-[rgba(12,12,12,0.02)] px-2 py-1.5 backdrop-blur-md md:flex">
          <a
            href="/signin"
            className="rounded-full px-5 py-2 font-gantari text-[15px] text-[rgba(12,12,12,0.70)] transition-colors hover:text-[#0C0C0C]"
          >
            Login
          </a>
          <a
            href="/signup"
            className="rounded-full bg-[#0C0C0C] px-5 py-2 font-instrument text-[15px] text-white transition-colors hover:bg-[#252525]"
          >
            Sign up
          </a>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="rounded-full border border-[rgba(12,12,12,0.06)] bg-white p-2.5 text-[#0C0C0C] md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-y-0 right-0 z-50 flex w-[320px] max-w-[85vw] flex-col bg-white px-6 py-6 shadow-2xl md:hidden"
        >
          <div className="flex justify-end">
            <button onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-6 w-6 text-[#0C0C0C]" />
            </button>
          </div>
          <ul className="mt-10 flex flex-col gap-6">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-gantari text-[22px] text-[#0C0C0C]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-auto space-y-3">
            <a
              href="/signin"
              className="block rounded-full border border-[rgba(12,12,12,0.1)] py-3 text-center font-gantari text-[15px] text-[#0C0C0C]"
            >
              Login
            </a>
            <a
              href="/signup"
              className="block rounded-full bg-[#0C0C0C] py-3 text-center font-gantari text-[15px] text-white"
            >
              Sign up
            </a>
            <p className="pt-4 text-center font-gantari text-xs text-[rgba(12,12,12,0.50)]">
              © 2026 Cartis. All rights reserved.
            </p>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
