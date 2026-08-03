"use client"

import { motion } from "motion/react"

const COINS = [
  { id: 1, size: 56, duration: 26, delay: 0, left: "6%", spin: 9, opacity: 0.55 },
  { id: 2, size: 40, duration: 32, delay: 4, left: "16%", spin: 7, opacity: 0.4 },
  { id: 3, size: 72, duration: 38, delay: 8, left: "28%", spin: 11, opacity: 0.5 },
  { id: 4, size: 48, duration: 24, delay: 2, left: "44%", spin: 8, opacity: 0.45 },
  { id: 5, size: 60, duration: 34, delay: 6, left: "58%", spin: 10, opacity: 0.5 },
  { id: 6, size: 40, duration: 28, delay: 10, left: "70%", spin: 7, opacity: 0.4 },
  { id: 7, size: 64, duration: 40, delay: 0, left: "82%", spin: 12, opacity: 0.55 },
  { id: 8, size: 44, duration: 30, delay: 5, left: "92%", spin: 8, opacity: 0.45 },
]

function Coin({
  size,
  spin,
  opacity,
}: {
  size: number
  spin: number
  opacity: number
}) {
  const face =
    "absolute inset-0 flex items-center justify-center rounded-full border border-amber-200/50 text-lg font-semibold text-amber-50/90"
  return (
    <motion.div
      className="relative"
      style={{ width: size, height: size, opacity, transformStyle: "preserve-3d" }}
      animate={{ rotateY: 360 }}
      transition={{ duration: spin, repeat: Infinity, ease: "linear" }}
    >
      <div
        className={face}
        style={{ backfaceVisibility: "hidden", background: "linear-gradient(135deg, rgba(253,230,138,0.55), rgba(217,119,6,0.45))" }}
      >
        ₹
      </div>
      <div
        className={face}
        style={{
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "linear-gradient(315deg, rgba(217,119,6,0.5), rgba(253,230,138,0.45))",
        }}
      >
        ₹
      </div>
    </motion.div>
  )
}

export function FloatingCoins({
  heading = "EVERY RUPEE ACCOUNTED FOR",
  subheading = "TABS · ALERTS · TRACKING",
  description = "Set a monthly tab, watch the price trends, and get an alert the moment a purchase would break the plan.",
}: {
  heading?: string
  subheading?: string
  description?: string
}) {
  return (
    <section id="budget" className="relative overflow-hidden px-6 py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {COINS.map((coin) => (
          <motion.div
            key={coin.id}
            className="absolute -top-24"
            style={{ left: coin.left }}
            animate={{ y: ["0vh", "110vh"] }}
            transition={{
              duration: coin.duration,
              delay: coin.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <Coin size={coin.size} spin={coin.spin} opacity={coin.opacity} />
          </motion.div>
        ))}
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-light uppercase tracking-[0.25em] text-white mix-blend-difference md:text-6xl">
          {heading}
        </h2>
        <p className="mt-4 text-sm font-light uppercase tracking-[0.3em] text-white/60 mix-blend-difference">
          {subheading}
        </p>
        {description && (
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/70">
            {description}
          </p>
        )}
      </div>
    </section>
  )
}
