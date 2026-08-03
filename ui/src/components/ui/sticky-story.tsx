"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

const STORY_STATS = [
  { id: 1, prefix: "<", value: 10, suffix: "s", label: "verdict, not a lecture" },
  { id: 2, prefix: "₹", value: 600, suffix: "", label: "default monthly tab limit" },
  { id: 3, prefix: "", value: 100, suffix: "%", label: "of purchases tracked" },
  { id: 4, prefix: "", value: 3, suffix: "", label: "marketplaces covered" },
];

const ANSWER_CHIPS = ["Real wallet balance", "Price trends", "Plain-English verdicts"];

const CHAOS_CARDS = [
  {
    id: 1,
    pos: { left: "-4%", top: "-46%" },
    rotate: -9,
    drift: [60, -60],
    mx: 1,
    my: -1,
    title: "₹???",
    lines: ["vendor: unknown", "refund: unclear", "SKU: N/A"],
  },
  {
    id: 2,
    pos: { right: "-5%", top: "-42%" },
    rotate: 8,
    drift: [-50, 70],
    mx: -1,
    my: 1,
    title: "₹9?9",
    lines: ["trend: hidden", "budget: unlinked", "reviews: mixed"],
  },
  {
    id: 3,
    pos: { left: "1%", top: "112%" },
    rotate: 5,
    drift: [50, -40],
    mx: 1,
    my: 1,
    title: "₹1,49?",
    lines: ["wait / buy / ?", "urgency: ???", "source: 3 tabs"],
  },
  {
    id: 4,
    pos: { right: "3%", top: "108%" },
    rotate: -6,
    drift: [-60, -50],
    mx: -1,
    my: -1,
    title: "₹???.??",
    lines: ["wallet: offline", "tab: no data", "price: moved"],
  },
  {
    id: 5,
    pos: { left: "36%", top: "-54%" },
    rotate: 4,
    drift: [40, -70],
    mx: 1,
    my: -1,
    title: "BANK?",
    lines: ["upi: declined?", "status: pending", "eta: ?"],
  },
  {
    id: 6,
    pos: { right: "32%", top: "116%" },
    rotate: -4,
    drift: [-40, 50],
    mx: -1,
    my: -1,
    title: "₹0.00",
    lines: ["cart: abandoned", "price: +18%", "verdict: none"],
  },
].map((card, i) => ({
  ...card,
  range: [0.4 + i * 0.02, 0.46 + i * 0.02, 0.57 + i * 0.02, 0.64 + i * 0.02],
}));

function CountUp({
  prefix,
  to,
  suffix,
}: {
  prefix: string;
  to: number;
  suffix: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: "easeOut",
      onUpdate: (latest) => setValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

function RevealedWord({
  word,
  progress,
  start,
  end,
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.1, 1]);
  const y = useTransform(progress, [start, end], [30, 0]);
  const blur = useTransform(progress, [start, end], ["blur(8px)", "blur(0px)"]);
  return (
    <motion.span
      style={{ opacity, y, filter: blur }}
      className="inline-block will-change-transform"
    >
      {word}&nbsp;
    </motion.span>
  );
}

function WordLine({
  text,
  progress,
  from,
  to,
  className,
}: {
  text: string;
  progress: MotionValue<number>;
  from: number;
  to: number;
  className?: string;
}) {
  const words = text.split(" ");
  const step = (to - from) / words.length;
  return (
    <span className={className}>
      {words.map((word, i) => (
        <RevealedWord
          key={`${word}-${i}`}
          word={word}
          progress={progress}
          start={from + i * step}
          end={from + (i + 1) * step}
        />
      ))}
    </span>
  );
}

function RollingNumber({
  raw,
  prefix = "",
  suffix = "",
  className,
}: {
  raw: MotionValue<number>;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [value, setValue] = useState(0);
  useMotionValueEvent(raw, "change", (v) => setValue(Math.round(v)));
  return (
    <span className={className}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

function ChaosCard({
  card,
  progress,
  mouseX,
  mouseY,
}: {
  card: (typeof CHAOS_CARDS)[number];
  progress: MotionValue<number>;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}) {
  const [in0, in1, out0, out1] = card.range;
  const opacity = useTransform(progress, [in0, in1, out0, out1], [0, 1, 1, 0]);
  const drift = useTransform(progress, [0, 1], card.drift);
  const x = useTransform(mouseX, [-0.5, 0.5], [-card.mx * 26, card.mx * 26]);
  const y = useTransform(mouseY, [-0.5, 0.5], [-card.my * 20, card.my * 20]);
  return (
    <motion.div
      style={{ ...card.pos, opacity, rotate: card.rotate }}
      className="pointer-events-none absolute hidden md:block"
    >
      <motion.div style={{ y: drift }}>
        <motion.div style={{ x, y }}>
          <div className="w-44 rounded-xl border border-white/15 bg-black/45 p-3.5 shadow-2xl">
            <p className="text-lg font-semibold tracking-tight text-white/80">
              {card.title}
            </p>
            <div className="mt-2 space-y-1">
              {card.lines.map((line) => (
                <p key={line} className="text-[11px] leading-snug text-white/40">
                  {line}
                </p>
              ))}
            </div>
            <span className="mt-2.5 inline-block rounded-full bg-red-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
              unknown
            </span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Bar({
  label,
  value,
  progress,
}: {
  label: string;
  value: number;
  progress: MotionValue<number>;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-white/60">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          style={{ scaleX: progress }}
          className="h-full origin-left rounded-full bg-teal-300"
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-white/70">
        {value}%
      </span>
    </div>
  );
}

export function StickyStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    mass: 0.12,
    stiffness: 40,
    damping: 26,
  });

  const mouseX = useSpring(useMotionValue(0), { stiffness: 45, damping: 28 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 45, damping: 28 });

  const veilOpacity = useTransform(progress, [0, 0.7], [0.18, 0.5]);

  const orbAX = useTransform(progress, [0, 1], [140, -140]);
  const orbAY = useTransform(progress, [0, 1], [100, -120]);
  const orbBX = useTransform(progress, [0, 1], [-120, 130]);
  const orbBY = useTransform(progress, [0, 1], [90, -100]);
  const orbMX = useTransform(mouseX, [-0.5, 0.5], [-34, 34]);
  const orbMY = useTransform(mouseY, [-0.5, 0.5], [-34, 34]);

  const ghostOpacity = useTransform(progress, [0.62, 0.78], [0, 1]);
  const counterRaw = useTransform(progress, [0.68, 0.94], [0, 100]);

  const s1Opacity = useTransform(progress, [0, 0.3, 0.42], [1, 1, 0]);
  const s1Y = useTransform(progress, [0, 0.42], [0, -90]);
  const s1Scale = useTransform(progress, [0, 0.42], [1, 0.95]);
  const s1Sub = useTransform(progress, [0.16, 0.24], [0, 1]);

  const s2Opacity = useTransform(progress, [0.38, 0.5, 0.56, 0.66], [0, 1, 1, 0]);
  const s2Y = useTransform(progress, [0.38, 0.5], [90, 0]);
  const s2Drift = useTransform(progress, [0.5, 0.66], [0, -90]);
  const s2Sub = useTransform(progress, [0.46, 0.52], [0, 1]);

  const s3Opacity = useTransform(progress, [0.64, 0.78], [0, 1]);
  const s3Y = useTransform(progress, [0.64, 0.78], [120, 0]);
  const s3Drift = useTransform(progress, [0.78, 1], [0, -50]);
  const s3Sub = useTransform(progress, [0.72, 0.8], [0, 1]);
  const chipsOpacity = useTransform(progress, [0.74, 0.82], [0, 1]);

  const cardOpacity = useTransform(progress, [0.68, 0.8], [0, 1]);
  const cardY = useTransform(progress, [0.68, 0.8], [80, 0]);
  const cardScale = useTransform(progress, [0.68, 0.8], [0.9, 1]);
  const cardTiltX = useTransform(mouseY, [-0.5, 0.5], [6, -6]);
  const cardTiltY = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);
  const barA = useTransform(progress, [0.72, 0.86], [0, 1]);
  const barB = useTransform(progress, [0.76, 0.9], [0, 1]);
  const verdictScale = useTransform(progress, [0.8, 0.87], [0, 1]);

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section ref={sectionRef} className="relative h-[420vh]">
      <div
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6"
      >
        <motion.div
          style={{ x: orbAX, y: orbAY }}
          className="pointer-events-none absolute left-[8%] top-[12%]"
        >
          <motion.div
            style={{ x: orbMX, y: orbMY }}
            className="h-72 w-72 rounded-full bg-teal-300/20 blur-[90px]"
          />
        </motion.div>
        <motion.div
          style={{ x: orbBX, y: orbBY }}
          className="pointer-events-none absolute bottom-[10%] right-[6%]"
        >
          <motion.div
            style={{ x: orbMX, y: orbMY }}
            className="h-80 w-80 rounded-full bg-cyan-400/15 blur-[100px]"
          />
        </motion.div>

        <motion.div
          style={{ opacity: veilOpacity }}
          className="pointer-events-none absolute inset-0 bg-black"
        />

        <motion.div
          style={{ opacity: ghostOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <RollingNumber
            raw={counterRaw}
            suffix="%"
            className="text-[10rem] font-black leading-none tracking-tighter text-white/[0.05] md:text-[18rem]"
          />
        </motion.div>



        <motion.div
          style={{ opacity: s1Opacity, y: s1Y, scale: s1Scale }}
          className="absolute inset-0 flex items-center justify-center px-6"
        >
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-light uppercase tracking-[0.3em] text-teal-200">
              The problem
            </p>
            <h2 className="mt-6 text-5xl font-light text-white md:text-7xl">
              <WordLine
                text="Purchases happen every day."
                progress={progress}
                from={0.02}
                to={0.12}
              />
              <br />
              <WordLine
                text="Most of them happen blind."
                progress={progress}
                from={0.12}
                to={0.22}
                className="text-teal-200/90"
              />
            </h2>
            <motion.p
              style={{ opacity: s1Sub }}
              className="mx-auto mt-8 max-w-2xl text-lg font-light text-white/80 md:text-xl"
            >
              Prices move, budgets drift, and nothing warns you before checkout.
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          style={{ opacity: s2Opacity, y: s2Drift }}
          className="absolute inset-0 flex items-center justify-center px-6"
        >
          <motion.div style={{ y: s2Y }} className="relative mx-auto max-w-5xl text-center">
            <p className="text-sm font-light uppercase tracking-[0.3em] text-teal-200">
              The data
            </p>
            <h2 className="mt-6 text-4xl font-light text-white md:text-6xl">
              <WordLine
                text="None of it talks to each other."
                progress={progress}
                from={0.41}
                to={0.5}
              />
            </h2>
            <motion.p
              style={{ opacity: s2Sub }}
              className="mx-auto mt-6 max-w-2xl text-lg font-light text-white/80 md:text-xl"
            >
              Your wallet, the price, the trend, your budget — every layer disconnected
              from every other.
            </motion.p>
            {CHAOS_CARDS.map((card) => (
              <ChaosCard
                key={card.id}
                card={card}
                progress={progress}
                mouseX={mouseX}
                mouseY={mouseY}
              />
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          style={{ opacity: s3Opacity, y: s3Drift }}
          className="absolute inset-0 flex items-center justify-center px-6"
        >
          <motion.div
            style={{ y: s3Y }}
            className="mx-auto flex w-full max-w-5xl flex-col items-center text-center"
          >
            <p className="text-sm font-light uppercase tracking-[0.3em] text-teal-200">
              The Cartis answer
            </p>
            <h2 className="mt-6 text-balance text-4xl font-light text-white md:text-6xl">
              <WordLine
                text="Cartis reads your money in real time."
                progress={progress}
                from={0.66}
                to={0.76}
              />
            </h2>
            <motion.p
              style={{ opacity: s3Sub }}
              className="mx-auto mt-6 max-w-2xl text-lg font-light text-white/80 md:text-xl"
            >
              Structure, accuracy, and honesty at every layer of the purchase.
            </motion.p>

            <motion.div
              style={{
                opacity: cardOpacity,
                y: cardY,
                scale: cardScale,
                rotateX: cardTiltX,
                rotateY: cardTiltY,
                transformPerspective: 1000,
              }}
              className="mt-10 w-full max-w-md rounded-2xl border border-white/20 bg-black/40 p-5 text-left backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Noise Headphones</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    ₹1,499{" "}
                    <span className="text-sm font-normal text-white/40 line-through">
                      ₹1,899
                    </span>
                  </p>
                </div>
                <motion.span
                  style={{ scale: verdictScale }}
                  className="rounded-full bg-teal-300 px-4 py-1.5 text-sm font-bold text-teal-950"
                >
                  BUY
                </motion.span>
              </div>
              <div className="mt-5 space-y-3">
                <Bar label="Budget fit" value={92} progress={barA} />
                <Bar label="Price trend" value={74} progress={barB} />
              </div>
            </motion.div>

            <motion.div
              style={{ opacity: chipsOpacity }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              {ANSWER_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90"
                >
                  {chip}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3">
          <div className="h-[2px] w-44 overflow-hidden rounded-full bg-white/10">
            <motion.div
              style={{ scaleX: progress }}
              className="h-full origin-left bg-teal-300"
            />
          </div>
          <p className="text-[11px] font-light uppercase tracking-[0.35em] text-white/40">
            Scroll to read — the cards follow your cursor
          </p>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-6 pt-24 md:pt-32">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-4">
          {STORY_STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 bg-black/20 px-4 py-8 text-center backdrop-blur-sm"
            >
              <span className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                <CountUp prefix={s.prefix} to={s.value} suffix={s.suffix} />
              </span>
              <span className="text-[13px] text-white/70">{s.label}</span>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
