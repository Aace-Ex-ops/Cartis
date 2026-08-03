"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue, type MotionValue } from "motion/react";

export interface CollectionItem {
  id: number;
  title: string;
  body: string;
}

export type CollectionSurferVariant = "magnetic" | "uplift" | "simple";

// Default items for the component in case none are provided
const ITEMS: CollectionItem[] = [
  { id: 1, title: "VERDICTS", body: "Buy, wait, or avoid — with a plain-English reason tied to your real budget." },
  { id: 2, title: "BUDGET", body: "Monthly tab limits and wallet balance that keep your spending honest." },
  { id: 3, title: "TRACKING", body: "Every purchase, analysis history, and price trend in one place." },
  { id: 4, title: "ALERTS", body: "Overspend warnings that fire before the damage, not after." },
  { id: 5, title: "TRENDS", body: "Price patterns and spending habits you can actually act on." },
  { id: 6, title: "WALLET", body: "Your real money, structured — no fluff, no affiliate bias." },
];

interface CollectionSurferProps {
  items?: CollectionItem[];
  variant?: CollectionSurferVariant;
  heading?: string;
  subheading?: string;
}

export function CollectionSurfer({
  items = ITEMS,
  variant = "magnetic",
  heading = "CARTIS",
  subheading = "SHOWCASE",
}: CollectionSurferProps) {
  // Section-scoped container. The scroll progress of THIS section drives the loop,
  // so multiple surfers can live on one page.
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // 1. Loop Setup: Duplicate items to create a buffer
  // We render the list twice: [Original Set, Duplicate Set]
  // When we scroll past the Original Set, we snap back to the start.
  const duplicatedItems = [...items, ...items];

  // Scroll sensitivity
  const scrollPerItem = 600;

  // The exact scroll distance to complete one full loop of the ORIGINAL items
  const loopDistance = items.length * scrollPerItem;

  // Map the section's scroll progress (0 -> 1) to a pseudo scroll distance.
  // One loop per section: the animation completes exactly one full pass of all
  // items and lands back on the first card just as the next section begins.
  const loops = 1;
  const pseudoScroll = useTransform(scrollYProgress, [0, 1], [0, loopDistance * loops]);

  const smoothScroll = useSpring(pseudoScroll, {
    mass: 0.1,
    stiffness: 100,
    damping: 20,
  });

  // 2. Modulo Logic:
  // Instead of mapping 0 -> totalScroll, we map to a looped value.
  // loops 0 -> loopDistance -> 0 -> loopDistance...
  const loopedProgress = useTransform(smoothScroll, (value) => value % loopDistance);

  // Step vector
  const stepX = 240;
  const stepY = -84;
  const stepZ = -288;

  // We only move the scene backwards by the length of ONE set of items
  const x = useTransform(loopedProgress, [0, loopDistance], [0, -items.length * stepX]);
  const y = useTransform(loopedProgress, [0, loopDistance], [0, -items.length * stepY]);
  const z = useTransform(loopedProgress, [0, loopDistance], [0, -items.length * stepZ]);

  // Mouse position for magnetic effect
  // Initialize off-screen so no card is scaled by default
  const mouseX = useMotionValue(-10000);
  const mouseY = useMotionValue(-10000);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (variant === "simple") return;
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  const handleMouseLeave = () => {
    if (variant === "simple") return;
    mouseX.set(-10000);
    mouseY.set(-10000);
  };

  return (
    <div
      ref={sectionRef}
      className="relative min-h-screen w-full"
      style={{ height: `${loops * 400}vh` }}
    >
      {/* Pinned viewport */}
      <div
        className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center perspective-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* UI Overlays */}
        <div className="absolute top-[3vw] left-[3vw] z-50 pointer-events-none mix-blend-difference">
          <h1 className="font-heading font-bold text-[clamp(2rem,6vw,5rem)] leading-[0.9] tracking-tighter ml-[4vw]">
            {heading}
          </h1>
          <h1 className="font-heading font-bold text-[clamp(2rem,6vw,5rem)] leading-[0.9] tracking-tighter">
            {subheading}
            <span className="text-[0.4em] align-top relative top-[0.6em] ml-2 font-mono tabular-nums">
              ({items.length})
            </span>
          </h1>
        </div>

        <div className="absolute bottom-[3vw] right-[3vw] z-50 font-mono text-xs tracking-wider uppercase opacity-70">
          scroll to surf
        </div>

        {/* 3D Scene */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            perspective: "2000px",
            perspectiveOrigin: "10% 10%",
          }}
        >
          {/* Animated Track */}
          <motion.div
            className="relative w-0 h-0"
            style={{
              x,
              y,
              z,
              transformStyle: "preserve-3d",
            }}
          >
            {duplicatedItems.map((item, i) => (
              <Card
                key={`${item.id}-${i}`}
                item={item}
                i={i}
                stepX={stepX}
                stepY={stepY}
                stepZ={stepZ}
                mouseX={mouseX}
                mouseY={mouseY}
                scrollSpring={smoothScroll}
                variant={variant}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Card({
  item,
  i,
  stepX,
  stepY,
  stepZ,
  mouseX,
  mouseY,
  scrollSpring,
  variant,
}: {
  item: CollectionItem;
  i: number;
  stepX: number;
  stepY: number;
  stepZ: number;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  scrollSpring: MotionValue<number>;
  variant: CollectionSurferVariant;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Calculate distance from mouse to center of card
  const distance = useTransform([mouseX, mouseY, scrollSpring], ([mx, my]: number[]) => {
    if (!ref.current || variant === "simple") return 200; // Default large distance
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.sqrt(Math.pow(mx - centerX, 2) + Math.pow(my - centerY, 2));
    return dist;
  });

  // --- Magnetic Variant ---
  // Map distance to scale: Closer = larger
  const targetScale = useTransform(distance, [0, 400], [1.5, 1]);
  const springScale = useSpring(targetScale, {
    mass: 0.5,
    stiffness: 300,
    damping: 20,
  });

  // --- Uplift Variant ---
  // Map distance to Y uplift: Closer = move up (negative Y)
  const targetUplift = useTransform(distance, [0, 400], [-100, 0]);
  const springUplift = useSpring(targetUplift, {
    mass: 0.5,
    stiffness: 300,
    damping: 20,
  });

  // Combine transforms based on variant
  const transform = useTransform([springScale, springUplift], ([s, u]: number[]) => {
    let scaleValue = 1;
    let upliftValue = 0;

    if (variant === "magnetic") {
      scaleValue = Number(s);
    } else if (variant === "uplift") {
      upliftValue = Number(u);
    }

    const baseX = i * stepX;
    const baseY = i * stepY;
    const baseZ = i * stepZ;

    return `translate3d(${baseX}px, ${baseY + upliftValue}px, ${baseZ}px) rotateY(-50deg) scale(${scaleValue})`;
  });

  return (
    <motion.div
      ref={ref}
      className="absolute w-[300px] h-[400px] border border-white/15 bg-white/10 backdrop-blur-md overflow-hidden shadow-2xl transition-colors duration-500 ease-out group"
      style={{
        transform,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Index number: Using i % 16 + 1 so the duplicate cards show correct numbers (01-16) */}
      <div className="absolute -top-6 -left-4 text-white font-mono text-xs opacity-50 transition-opacity group-hover:opacity-100">
        {String((i % 16) + 1).padStart(2, "0")}
      </div>

      {/* Text content */}
      <div className="relative w-full h-full flex flex-col justify-end p-6">
        <h3 className="text-white text-2xl font-semibold tracking-tight leading-tight mb-2">
          {item.title}
        </h3>
        <p className="text-white/70 text-sm leading-relaxed">{item.body}</p>
      </div>

      <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
    </motion.div>
  );
}
