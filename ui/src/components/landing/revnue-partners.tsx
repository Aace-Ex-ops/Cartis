"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const PARTNERS = ["Finlytics", "LedgerPro", "RupeeFlow", "GSTZen", "TaxPilot", "InvoiceIQ"];

const STATEMENT =
  "In just two days, you'll discover how to automate your money, streamline accounting, and gain complete visibility into cash flow, reporting, and business performance — all through one AI-powered financial platform.";

const HIGHLIGHT = new Set(["automate", "accounting", "visibility", "AI-powered"]);

function Marquee() {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-16 pr-16">
      {PARTNERS.map((p) => (
        <span
          key={`${key}-${p}`}
          className="font-gantari text-2xl font-medium text-white/50 transition-colors hover:text-white"
        >
          {p}
        </span>
      ))}
    </div>
  );
  return (
    <div className="landing-marquee-mask overflow-hidden">
      <div className="landing-marquee-track">
        {[0, 1, 2, 3].map((n) => row(`r${n}`))}
      </div>
    </div>
  );
}

export function RevnuePartners() {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30% 0px" });
  const words = STATEMENT.split(" ");

  return (
    <section className="bg-[#0C0C0C] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-gantari text-[22px] text-[rgba(255,255,255,0.80)]"
        >
          Client Partners
        </motion.p>
        <div className="mt-10">
          <Marquee />
        </div>

        <h3
          ref={ref}
          className="mx-auto mt-24 max-w-5xl font-gantari text-[28px] font-medium leading-[1.14] tracking-[-1px] text-white md:mt-32 md:text-6xl md:tracking-[-3px]"
        >
          {words.map((word, i) => {
            const clean = word.replace(/[^A-Za-z-]/g, "");
            const hot = HIGHLIGHT.has(clean);
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0.3, color: "rgba(255,255,255,0.30)" }}
                animate={inView ? { opacity: 1, color: "#ffffff" } : {}}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className={hot ? "italic" : ""}
              >
                {word}{" "}
              </motion.span>
            );
          })}
        </h3>
      </div>
    </section>
  );
}
