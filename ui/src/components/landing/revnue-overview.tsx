"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";

const BG_VIDEO = "/landing/videos/overview-bg.mp4";
const ARROW = "/landing/svg/right-arrow.svg";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const lineReveal = {
  hidden: { y: "120%" },
  visible: { y: 0, transition: { duration: 1.2, ease: EASE } },
};

export function RevnueOverview() {
  const [hover, setHover] = useState(false);

  return (
    <section
      id="overview-section"
      className="relative w-full h-screen min-h-[600px] md:min-h-[800px] flex items-start justify-end overflow-hidden"
      style={{ paddingTop: 96, paddingBottom: 96 }}
    >
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover select-none pointer-events-none"
          src={BG_VIDEO}
        />
        <div className="absolute inset-0 bg-white/5" />
      </div>
      <div className="relative z-10 w-full h-full flex items-start justify-end px-4 sm:px-8 md:px-12 xl:px-16">
        <motion.div
          className="flex flex-col items-end gap-[32px] sm:gap-[48px] md:gap-[64px] w-full lg:w-[880px] text-right"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.15 }}
        >
          <div className="flex flex-col items-end w-full">
            <motion.div
              variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 1, ease: EASE } } }}
              className="text-[#0C0C0C]/80 font-gantari text-[14px] sm:text-[18px] md:text-[20px] font-medium tracking-[-0.6px] leading-normal mb-[8px] sm:mb-[12px]"
            >
              Solution Overview
            </motion.div>
            <h2 className="text-[#0C0C0C] font-inclusive text-[34px] sm:text-[56px] md:text-[76px] lg:text-[100px] font-medium leading-[96%] tracking-[-1.5px] sm:tracking-[-4px] md:tracking-[-6px] lg:tracking-[-8px] flex flex-col items-end w-full mb-[12px] sm:mb-[16px]">
              <span className="block overflow-hidden py-1 w-full">
                <motion.span className="inline-block origin-bottom w-full text-right" variants={lineReveal}>
                  Full control of
                </motion.span>
              </span>
              <span className="block overflow-hidden py-1 w-full">
                <motion.span className="inline-block origin-bottom w-full text-right" variants={lineReveal}>
                  your money.
                </motion.span>
              </span>
            </h2>
            <motion.p
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 0.8, y: 0, transition: { duration: 1.1, ease: EASE } } }}
              className="text-[#0C0C0C]/80 font-gantari text-[15px] sm:text-[18px] md:text-[21px] lg:text-[24px] font-normal leading-[150%] tracking-[-0.3px] sm:tracking-[-0.6px] lg:tracking-[-0.82px] max-w-[700px] w-full"
            >
              Wallet, bank, budget, and business — one place that reads your real money and tells
              you what to do before you spend it.
            </motion.p>
          </div>
          <motion.a
            href="/signup"
            variants={{
              hidden: { opacity: 0, scale: 0.9, y: 30 },
              visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } },
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="group flex items-center justify-center gap-3 sm:gap-[16px] bg-white hover:bg-[#F9F9F9] rounded-full hover:shadow-xl active:scale-[0.98] transition-colors duration-300 cursor-pointer border border-[#0C0C0C]/5"
            style={{ paddingTop: "4px", paddingBottom: "4px", paddingLeft: hover ? "4px" : "18px", paddingRight: hover ? "18px" : "4px", flexDirection: hover ? "row-reverse" : "row", transition: "padding 0.35s ease, background-color 0.3s, box-shadow 0.3s, transform 0.15s ease" }}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="text-[#0C0C0C] font-gantari text-[16px] sm:text-[20px] md:text-[24px] font-medium leading-[150%] tracking-[-0.4px] sm:tracking-[-0.6px] lg:tracking-[-0.82px] select-none"
            >
              Get Started
            </motion.span>
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="w-8 h-8 sm:w-[48px] sm:h-[48px] rounded-full bg-[#0C0C0C] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
            >
              <Image src={ARROW} alt="Arrow" className="w-4 h-4 sm:w-6 sm:h-6" width={24} height={24} referrerPolicy="no-referrer" />
            </motion.div>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
