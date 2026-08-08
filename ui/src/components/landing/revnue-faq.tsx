"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const FAQS = [
  {
    q: "What is Cartis?",
    a: "Cartis is an AI financial coach for India. It connects to your real money — wallet, bank, budgets, and business ledger — and tells you what to do before you spend, with an AI advisor for your business too.",
  },
  {
    q: "How does the extension work?",
    a: "Install it, browse like normal, and Cartis checks price, budget, and urgency against your real money. You get a Buy / Wait / Avoid verdict with a plain-English reason tied to your actual budget.",
  },
  {
    q: "Is my financial data secure?",
    a: "Industry-standard encryption, short-lived rotating sessions, and strict access controls. Bank data flows through regulated channels (Account Aggregator) with your explicit, revocable consent.",
  },
  {
    q: "Can it work with my business too?",
    a: "Yes. Sellers get income and expense tracking, P&L, GST, cash flow, inventory, and an AI Financial Advisor that benchmarks you against your industry and produces investor-ready reports.",
  },
  {
    q: "How much does it cost?",
    a: "Start free. Cartis Pro unlocks the financial advisor report and PDF export. No hidden fees, cancel anytime.",
  },
  {
    q: "How quickly can I get started?",
    a: "Sign up in seconds. Install the extension in one click and connect your bank or ledger — most people are fully set up in under five minutes.",
  },
];

export function RevnueFaq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="min-h-screen bg-white py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-gantari text-[22px] text-[rgba(12,12,12,0.70)]"
            >
              FAQs
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-4 font-inclusive text-4xl font-medium tracking-[-2px] text-[#0C0C0C] md:text-6xl md:tracking-[-3px]"
            >
              Frequently asked questions.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 max-w-2xl font-gantari text-lg text-[rgba(12,12,12,0.70)]"
            >
              Everything you need to know about Cartis — from getting started to security and
              integrations.
            </motion.p>
          </div>
          <a
            href="/signup"
            className="group hidden shrink-0 items-center gap-3 rounded-full bg-[#0C0C0C] py-2.5 pl-6 pr-2.5 font-gantari text-base font-medium text-white transition-colors hover:bg-black/90 md:inline-flex"
          >
            Contact Us
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0C0C0C]">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>

        <div className="mt-14 space-y-4">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className="overflow-hidden rounded-xl transition-colors duration-300"
                style={{
                  background: isOpen ? "#F3F3F3" : "#FFF",
                  border: isOpen ? "1px solid transparent" : "1px solid #F3F3F3",
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                >
                  <span
                    className={`font-gantari text-[17px] font-medium tracking-[-0.02em] md:text-2xl ${
                      isOpen ? "text-[#0C0C0C]" : "text-[rgba(12,12,12,0.80)]"
                    }`}
                  >
                    {f.q}
                  </span>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isOpen ? "bg-[#0C0C0C] text-white" : "border border-[#EFEFEF] bg-[#F3F3F3] text-[#0C0C0C]"
                    }`}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                    >
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="px-6 pb-6 font-instrument text-base leading-relaxed text-[rgba(12,12,12,0.70)] md:text-lg">
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
