"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";

const ARROW_RIGHT = "/landing/svg/arrow-right.svg";
const ARROW_RIGHT_UP = "/landing/svg/arrow-right-up.svg";

const STEPS = [
  {
    id: "01",
    cardTitle: "Install & connect",
    cardSubtitle:
      "Install the extension or sign in, then connect your bank or add your ledger. Cartis meets your money where it is.",
    bgImage: "/landing/images/card-bg-01.png",
    numberSvg: "/landing/svg/number-01.svg",
    hoverNumberSvg: "/landing/svg/hover-number-01.svg",
  },
  {
    id: "02",
    cardTitle: "Shop & track",
    cardSubtitle:
      "Browse like normal. Cartis checks price, budget, and urgency against your real money in the background.",
    bgImage: "/landing/images/card-bg-02.png",
    numberSvg: "/landing/svg/number-02.svg",
    hoverNumberSvg: "/landing/svg/hover-number-02.svg",
  },
  {
    id: "03",
    cardTitle: "Get honest verdicts",
    cardSubtitle:
      "Buy, wait, or avoid — with a plain-English reason tied to your actual budget and wallet.",
    bgImage: "/landing/images/card-bg-03.png",
    numberSvg: "/landing/svg/number-03.svg",
    hoverNumberSvg: "/landing/svg/hover-number-01.svg",
  },
  {
    id: "04",
    cardTitle: "Grow & optimize",
    cardSubtitle:
      "Financial advisor, goals, tools, and reports that turn your numbers into a plan you can act on.",
    bgImage: "/landing/images/card-bg-04.png",
    numberSvg: "/landing/svg/number-04.svg",
    hoverNumberSvg: "/landing/svg/hover-number-01.svg",
  },
];

function StepCard({
  step,
  onInteract,
  isFirstCard = true,
}: {
  step: (typeof STEPS)[number] & { isFocused?: boolean };
  onInteract: () => void;
  isFirstCard?: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      layout="position"
      onClick={onInteract}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative flex flex-col justify-between items-start flex-1 p-6 sm:p-8 rounded-2xl bg-[#F3F3F3] select-none cursor-pointer overflow-hidden transition-all duration-500 h-[460px] sm:h-[500px] lg:h-full"
      style={{ alignSelf: "stretch" }}
      initial={{ opacity: 0, x: 150 }}
      animate={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.1 }}
      transition={{ type: "spring", stiffness: 90, damping: 16, mass: 1.1, duration: 0.85, delay: isFirstCard ? 0.05 : 0.25 }}
    >
      {step.bgImage && (
        <Image
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 transition-opacity duration-500 ease-in-out"
          src={step.bgImage}
          alt=""
          width={800}
          height={900}
          style={{ opacity: +!hover }}
          referrerPolicy="no-referrer"
        />
      )}
      <div className="relative z-10 flex flex-col items-start gap-4 w-full">
        <h3 className="font-gantari text-2xl sm:text-[28px] font-semibold leading-[96%] tracking-[-2px] text-[#0C0C0C]">
          {step.cardTitle}
        </h3>
        <p
          className="font-instrument text-base sm:text-[18px] font-normal leading-[150%] tracking-[-0.82px]"
          style={{ color: "rgba(12, 12, 12, 0.80)" }}
        >
          {step.cardSubtitle}
        </p>
      </div>
      <div className="flex justify-between items-end w-full relative z-10 mt-auto">
        <div
          className={`inline-flex items-center gap-3.5 rounded-full transition-colors duration-300 ${
            hover ? "bg-[#0C0C0C] text-white" : "text-[#0C0C0C] bg-white"
          }`}
          style={{ padding: hover ? "4px 14px 4px 4px" : "4px 4px 4px 14px", flexDirection: hover ? "row-reverse" : "row" }}
        >
          <span className="font-gantari text-lg sm:text-[20px] font-medium leading-[150%] tracking-[-0.82px] select-none">
            Get Started
          </span>
          <div
            className={`w-10 h-10 flex justify-center items-center rounded-full transition-colors duration-300 ${
              hover ? "bg-white" : "bg-[#0C0C0C]"
            }`}
          >
            <Image
              className="w-5 h-5 transition-transform duration-300"
              src={hover ? ARROW_RIGHT_UP : ARROW_RIGHT}
              alt="Arrow icon"
              width={20}
              height={20}
              style={{ filter: hover ? "none" : "invert(1)" }}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
      <Image
        className="absolute right-0 bottom-0 select-none pointer-events-none w-[142px] h-[92px] opacity-80 z-20 transition-all duration-300"
        src={hover && step.hoverNumberSvg ? step.hoverNumberSvg : step.numberSvg}
        alt={`Step number ${step.id}`}
        width={142}
        height={92}
        referrerPolicy="no-referrer"
      />
    </motion.div>
  );
}

function Circle({
  step,
  isActive,
  opacity,
  onClick,
}: {
  step: (typeof STEPS)[number];
  isActive: boolean;
  opacity: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative focus:outline-none flex items-center justify-center cursor-pointer"
      style={{ width: "48px", height: "48px" }}
      aria-label={`Step ${step.id}`}
    >
      {isActive ? (
        <motion.div
          layoutId="activeCircle"
          className="absolute inset-0 bg-[#F3F3F3] rounded-full flex items-center justify-center border border-[rgba(12,12,12,0.08)] shadow-sm"
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <span className="font-gantari text-2xl font-semibold tracking-[-0.6px] text-center" style={{ color: "rgba(12, 12, 12, 0.80)" }}>
            {step.id}
          </span>
        </motion.div>
      ) : (
        <span
          className="font-gantari text-2xl font-medium italic tracking-[-0.6px] text-center transition-all duration-300 hover:scale-105"
          style={{ opacity, color: "rgba(12, 12, 12, 0.80)" }}
        >
          {step.id}
        </span>
      )}
    </button>
  );
}

export function RevnueHowItWorks() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const rafRef = useRef<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const tick = () => {
      const next = Math.min(((Date.now() - start) / 6000) * 100, 100);
      setProgress(next);
      if (next < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setActive((a) => (a + 1) % STEPS.length);
        setProgress(0);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, paused]);

  const select = (index: number) => {
    setActive(index);
    setProgress(0);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({
        left: index * (0.75 * carouselRef.current.offsetWidth + 24),
        behavior: "smooth",
      });
    }
  };

  const distanceOpacity = (id: string) => {
    const i = STEPS.findIndex((s) => s.id === id);
    if (i === active) return 1;
    const n = Math.abs(i - active);
    return n === 1 ? 0.6 : n === 2 ? 0.4 : 0.2;
  };

  const before: (typeof STEPS)[number][] =
    active === 0
      ? [STEPS[0]]
      : active === 1
        ? [STEPS[0], STEPS[1]]
        : active === 2
          ? [STEPS[0], STEPS[1], STEPS[2]]
          : [STEPS[0]];
  const after: (typeof STEPS)[number][] =
    active === 0
      ? [STEPS[1], STEPS[2], STEPS[3]]
      : active === 1
        ? [STEPS[2], STEPS[3]]
        : active === 2
          ? [STEPS[3]]
          : [STEPS[1], STEPS[2], STEPS[3]];

  const detail = [
    { ...STEPS[active], isFocused: true, index: active },
    { ...STEPS[(active + 1) % STEPS.length], isFocused: false, index: (active + 1) % STEPS.length },
  ];

  return (
    <section
      id="how-it-works"
      className="relative w-full bg-white flex justify-center items-center overflow-hidden"
      style={{ paddingTop: 96, paddingBottom: 96 }}
    >
      <div
        className="w-full flex flex-col lg:flex-row items-center gap-6 lg:gap-12 px-4 sm:px-8 md:px-12 xl:px-16"
        style={{ alignSelf: "stretch" }}
      >
        <div
          className="flex flex-col items-start w-full lg:w-[724px] lg:pr-[40px] justify-between gap-12 lg:gap-[160px] xl:gap-[200px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <motion.div
            className="flex items-center gap-6 w-full select-none"
            style={{ alignSelf: "stretch" }}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center w-full gap-0">
              <div className="flex items-center gap-6">
                {before.map((s) => (
                  <Circle
                    key={s.id}
                    step={s}
                    isActive={s.id === STEPS[active].id}
                    opacity={distanceOpacity(s.id)}
                    onClick={() => select(STEPS.findIndex((x) => x.id === s.id))}
                  />
                ))}
              </div>
              <div className="flex-1 h-[4px] bg-[rgba(12,12,12,0.1)] rounded-full relative overflow-hidden mx-0">
                <motion.div className="h-full bg-[#0C0C0C]" style={{ width: `${progress}%` }} transition={{ ease: "linear" }} />
              </div>
              <div className="flex items-center gap-6">
                {after.map((s) => (
                  <Circle
                    key={s.id}
                    step={s}
                    isActive={s.id === STEPS[active].id}
                    opacity={distanceOpacity(s.id)}
                    onClick={() => select(STEPS.findIndex((x) => x.id === s.id))}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col items-start gap-10 w-full" style={{ alignSelf: "stretch" }}>
            <div className="flex flex-col items-start w-full">
              <motion.span
                className="font-gantari text-xl font-medium tracking-[-0.6px] mb-3 inline-block"
                style={{ color: "rgba(12, 12, 12, 0.80)" }}
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                How it works
              </motion.span>
              <motion.h2
                className="font-inclusive text-[40px] sm:text-[60px] lg:text-[76px] font-medium leading-[96%] tracking-[-2px] sm:tracking-[-5px] w-full max-w-[600px] text-[#0C0C0C] mb-4"
                initial={{ opacity: 0, x: -70 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                Four steps to smarter money with Cartis.
              </motion.h2>
              <motion.p
                className="font-gantari text-lg sm:text-[24px] font-normal leading-[150%] tracking-[-0.82px] w-full max-w-[640px]"
                style={{ color: "rgba(12, 12, 12, 0.80)" }}
                initial={{ opacity: 0, x: -90 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                A simple process to streamline your financial operations and drive real growth — in
                your wallet and your business.
              </motion.p>
            </div>
            <motion.button
              layout
              onClick={() => select((active + 1) % STEPS.length)}
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => setCtaHover(false)}
              className="inline-flex py-1.5 justify-center items-center gap-4 rounded-full bg-[#0C0C0C] hover:bg-black/90 active:scale-95 transition-colors duration-300 cursor-pointer group"
              style={{ padding: ctaHover ? "4px 18px 4px 4px" : "4px 4px 4px 18px", alignItems: "center", flexDirection: ctaHover ? "row-reverse" : "row" }}
              initial={{ opacity: 0, x: -110 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{
                opacity: { duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] },
                x: { duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] },
                layout: { type: "spring", stiffness: 380, damping: 28 },
              }}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="font-gantari text-lg sm:text-[24px] font-medium leading-[150%] tracking-[-0.82px] text-white"
              >
                Get Started
              </motion.span>
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="w-12 h-12 flex justify-center items-center rounded-full bg-white transition-all duration-300"
              >
                <Image
                  className="w-6 h-6 transform group-hover:translate-x-0.5 transition-transform duration-300"
                  src={ARROW_RIGHT}
                  alt="Arrow right"
                  width={24}
                  height={24}
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </motion.button>
          </div>
        </div>

        <div
          className="hidden lg:flex items-stretch gap-6 flex-1 w-full"
          style={{ alignSelf: "stretch", perspective: "1200px" }}
        >
          {detail.map((s, i) => (
            <StepCard
              key={s.index}
              step={s}
              onInteract={() => select(s.index)}
              isFirstCard={i === 0}
            />
          ))}
        </div>

        <div className="lg:hidden w-full -mx-4 sm:-mx-8 md:-mx-12 relative overflow-hidden py-3">
          <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10" />
          <div
            ref={carouselRef}
            onScroll={() => {
              if (!carouselRef.current) return;
              const t = Math.round(carouselRef.current.scrollLeft / (0.75 * carouselRef.current.offsetWidth + 24));
              if (t >= 0 && t < STEPS.length && t !== active) {
                setActive(t);
                setProgress(0);
              }
            }}
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
            className="w-full overflow-x-auto flex gap-6 py-2 snap-x snap-mandatory scrollbar-none px-4 sm:px-8 md:px-12"
          >
            {STEPS.map((s, n) => (
              <div key={s.id} className="snap-center shrink-0 w-[80vw] sm:w-[60vw]">
                <StepCard step={s} onInteract={() => select(n)} isFirstCard={n % 2 === 0} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
