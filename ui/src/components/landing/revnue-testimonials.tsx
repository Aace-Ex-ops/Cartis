"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const QUOTES = [
  {
    quote:
      "Cartis caught a ₹6,000 overspend mid-month, before my budget ever hit the wall. The verdicts feel like a finance nerd looking over my shoulder.",
    name: "Ananya R.",
    title: "Freelance designer, Bengaluru",
    initials: "AR",
  },
  {
    quote:
      "The financial advisor replaced three spreadsheets I never updated. My gross margin is finally under control, and my bank likes the reports.",
    name: "Rohit M.",
    title: "Founder, D2C skincare brand",
    initials: "RM",
  },
  {
    quote:
      "Month-end closing went from seven days to under twelve hours. The automation rules are incredibly precise, freeing up our entire finance team.",
    name: "Sarah J.",
    title: "CFO, CloudScale",
    initials: "SJ",
  },
  {
    quote:
      "I stopped impulse-buying gadgets once the extension started telling me when prices were actually good — and when to wait.",
    name: "Karan S.",
    title: "Product designer",
    initials: "KS",
  },
];

export function RevnueTestimonials() {
  const [i, setI] = useState(0);
  const q = QUOTES[i];

  return (
    <section id="testimonials" className="bg-[#0C0C0C] py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-gantari text-[22px] text-[rgba(255,255,255,0.80)]"
            >
              Testimonials
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-4 max-w-3xl font-inclusive text-4xl font-medium leading-[1.05] tracking-[-2px] text-white md:text-6xl md:tracking-[-3px]"
            >
              Our happy members built on trusted{" "}
              <span className="text-white/40">financial operations</span>
            </motion.h2>
          </div>
          <div className="hidden gap-3 md:flex">
            <button
              onClick={() => setI((i) => (i - 1 + QUOTES.length) % QUOTES.length)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white"
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
                <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => setI((i) => (i + 1) % QUOTES.length)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white"
              aria-label="Next"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[350px_1fr]">
          <div className="relative hidden h-[370px] overflow-hidden rounded-xl border border-white/10 bg-white/5 lg:block">
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(8px)" }}
                transition={{ duration: 0.5 }}
                className="flex h-full w-full flex-col items-center justify-center gap-4"
              >
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#0C0C0C] font-inclusive text-4xl text-white ring-1 ring-white/10">
                  {q.initials}
                </div>
                <div className="text-center">
                  <p className="font-gantari text-xl text-white">{q.name}</p>
                  <p className="mt-1 font-sans text-sm text-white/60">{q.title}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col justify-between rounded-2xl bg-white p-8 shadow-xl md:p-12">
            <div>
              <svg viewBox="0 0 46 40" fill="none" className="h-10 w-10 opacity-10">
                <path d="M0 40V24.2C0 10.9 7.2 2.6 19.4 0l2.3 7C15.1 9 11 13 11 18.4H20V40H0Zm26 0V24.2C26 10.9 33.2 2.6 45.4 0l2.3 7C41.1 9 37 13 37 18.4H46V40H26Z" fill="#0C0C0C" />
              </svg>
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4 }}
                  className="mt-6 font-instrument text-2xl italic leading-snug tracking-[-1px] text-[#0C0C0C] md:text-4xl"
                >
                  “{q.quote}”
                </motion.blockquote>
              </AnimatePresence>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <div className="flex items-center gap-4 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0C0C0C] font-inclusive text-sm text-white">
                  {q.initials}
                </div>
                <div>
                  <p className="font-gantari text-lg text-[#0C0C0C]">{q.name}</p>
                  <p className="font-sans text-sm text-[rgba(12,12,12,0.60)]">{q.title}</p>
                </div>
              </div>
              <span className="font-gantari italic text-[rgba(12,12,12,0.50)]">
                0{i + 1} / 0{QUOTES.length}
              </span>
              <div className="flex gap-3 md:hidden">
                <button
                  onClick={() => setI((i) => (i - 1 + QUOTES.length) % QUOTES.length)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#0C0C0C]/10"
                  aria-label="Previous"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#0C0C0C]">
                    <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => setI((i) => (i + 1) % QUOTES.length)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#0C0C0C]/10"
                  aria-label="Next"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#0C0C0C]">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
