"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

const BG_VIDEO = "/landing/videos/capabilities-bg.mp4";

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const h = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}

const CARDS = [
  {
    tags: ["Health score", "AI Advisor", "Financial analytics", "Benchmarking"],
    title: "Financial intelligence",
    subtitle:
      "See your real financial health with an AI coach that turns your numbers into clear, confident decisions.",
  },
  {
    tags: ["Budget alerts", "Price verdicts", "Auto insights", "Spending analysis"],
    title: "Automated workflows",
    subtitle:
      "Cartis watches your money in real time — budget alerts, spending insights, and buy-or-wait verdicts before you reach checkout.",
  },
  {
    tags: ["Wallet", "Bank sync", "Account Aggregator", "Forecasting"],
    title: "Cash flow control",
    subtitle:
      "Wallet balances, bank sync, and real transactions so you always know exactly where your money stands — and where it's heading.",
  },
];

function CardIcon({ title }: { title: string }) {
  const s = title.toLowerCase();
  if (s.includes("financial") || s.includes("intelligence")) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white shrink-0">
        <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 20v-6.75Z" />
      </svg>
    );
  }
  if (s.includes("automated") || s.includes("workflow")) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white shrink-0">
        <path
          fillRule="evenodd"
          d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white shrink-0">
      <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.81c-.397.075-.774.2-.111.371A2.44 2.44 0 0 0 9.75 9.5c0 .893.411 1.68 1.065 2.185.195.15.421.272.685.358v3.136c-.461-.106-.856-.356-1.125-.716a.75.75 0 1 0-1.19.914c.484.63 1.144 1.05 1.89 1.196v.811a.75.75 0 0 0 1.5 0v-.785c.465-.07.892-.2 1.285-.386a2.44 2.44 0 0 0 1.365-2.203c0-.928-.432-1.741-1.125-2.25a3.79 3.79 0 0 0-.675-.38V8.114c.338.077.639.227.874.439a.75.75 0 1 0 .97-1.14 3.94 3.94 0 0 0-1.844-.785V6Zm-1.5 5.513c-.328-.152-.5-.386-.5-.638 0-.256.17-.492.5-.644v1.282Zm1.5 1.866v1.354c.367-.145.5-.395.5-.674 0-.28-.133-.532-.5-.68Z" />
    </svg>
  );
}

function CapabilityCard({ tags, title, subtitle }: { tags: string[]; title: string; subtitle: string }) {
  const isMobile = useIsMobile();
  return (
    <motion.div
      className="relative flex flex-col justify-between items-center w-full lg:w-[calc(33.333%-16px)] h-[480px] p-8 rounded-2xl border overflow-hidden cursor-default group"
      initial="initial"
      whileInView="visible"
      whileHover="hover"
      viewport={{ once: true, margin: "-50px" }}
      variants={{
        initial: { opacity: 0, y: 50, backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(4px)" },
        visible: { opacity: 1, y: 0, backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(4px)", transition: { duration: 0.8, ease: "easeOut" } },
        hover: { backgroundColor: "rgba(255, 255, 255, 0.01)", borderColor: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(8px)", transition: { duration: 0.4, ease: "easeOut" } },
      }}
    >
      <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden z-0">
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.3) 45%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.3) 55%, transparent 70%)",
            backgroundSize: "200% 100%",
          }}
          variants={{ initial: { opacity: 0 }, visible: { opacity: 0 }, hover: { opacity: 1 } }}
          animate={isMobile ? {} : { backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{
            backgroundPosition: { duration: 3.5, repeat: isMobile ? 0 : Infinity, ease: "linear" },
            opacity: { duration: 0.3 },
          }}
        />
      </div>
      <div className="relative z-10 flex justify-between items-start gap-8 w-full">
        <motion.div
          className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#0C0C0C] text-white select-none shrink-0"
          animate={isMobile ? {} : { rotateY: [-20, 20, -20], rotate: [-6, 6, -6] }}
          transition={{ duration: 5, repeat: isMobile ? 0 : Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="flex items-center justify-center w-full h-full"
            variants={{ initial: { rotateX: 0 }, hover: { rotateX: 360 } }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <CardIcon title={title} />
          </motion.div>
        </motion.div>
        <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
          {tags.map((t, i) => (
            <div
              key={i}
              className="flex px-3 py-1 items-center justify-center rounded-full bg-white/40 border border-white/50 backdrop-blur-sm"
            >
              <span className="text-[#0C0C0C] text-center font-instrument text-xs sm:text-sm font-normal tracking-[-0.3px]">
                {t}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-start gap-4 w-full">
        <div className="overflow-hidden w-full">
          <motion.h4
            className="text-[#FFFFFF] font-gantari text-3xl sm:text-[38px] font-normal leading-[96%] tracking-[-1.5px] sm:tracking-[-3px] origin-left"
            variants={{ initial: { x: 0, y: 0 }, hover: { x: 4, y: -2 } }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            {title}
          </motion.h4>
        </div>
        <p className="text-[rgba(255,255,255,0.80)] font-instrument text-base sm:text-lg lg:text-[20px] font-normal leading-[150%] tracking-[-0.82px]">
          {subtitle}
        </p>
      </div>
    </motion.div>
  );
}

export function RevnueCapabilities() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.8;
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { el.play().catch(() => {}); }
        else { el.pause(); }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="features"
      className="relative w-full overflow-hidden px-6 md:px-12 min-[1440px]:px-12 min-[1441px]:px-16"
      style={{ paddingTop: 96, paddingBottom: 96 }}
    >
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          className="w-full h-full object-cover object-center select-none"
          src={BG_VIDEO}
        />
      </div>
      <div className="relative z-10 w-full flex flex-col gap-16">
        <div className="flex flex-col items-start gap-4 max-w-[767px] w-full text-left">
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 0.8, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-[rgba(12,12,12,0.80)] font-gantari text-lg sm:text-[20px] font-medium tracking-[-0.6px]"
          >
            Capabilities
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
            className="text-[#0C0C0C] font-inclusive text-5xl sm:text-7xl lg:text-[100px] font-medium leading-[96%] tracking-[-3px] sm:tracking-[-6px] lg:tracking-[-8px]"
          >
            Finance
            <br />
            made smarter.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 0.8, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="text-[rgba(12,12,12,0.80)] font-gantari text-lg sm:text-xl lg:text-[24px] font-normal leading-[150%] tracking-[-0.82px]"
          >
            Powerful capabilities to streamline every financial decision, automate the
            repetitive, and drive real-time clarity for your wallet and business.
          </motion.p>
        </div>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 w-full">
          {CARDS.map((c, i) => (
            <CapabilityCard key={i} tags={c.tags} title={c.title} subtitle={c.subtitle} />
          ))}
        </div>
      </div>
    </section>
  );
}
