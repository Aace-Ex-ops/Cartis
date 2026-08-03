"use client"

import { useRef } from "react"
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"

const LAYERS = [
  {
    id: 1,
    title: "WALLET",
    body: "Your real balance, read before every checkout — so spending never goes blind.",
    stat: "₹2,310 remaining",
    chipClass: "border-teal-300/40 bg-teal-300/10 text-teal-200",
    glow: "0 0 90px -20px rgba(45, 212, 191, 0.4)",
  },
  {
    id: 2,
    title: "TREND",
    body: "How this price moves over time, so you never buy at the top.",
    stat: "−18% in 14 days",
    chipClass: "border-amber-300/40 bg-amber-300/10 text-amber-200",
    glow: "0 0 90px -20px rgba(251, 191, 36, 0.3)",
  },
  {
    id: 3,
    title: "VERDICT",
    body: "Buy / Wait / Avoid with a plain-English reason, tied to your budget.",
    stat: "WAIT · 3 weeks",
    chipClass: "border-emerald-300/40 bg-emerald-300/10 text-emerald-200",
    glow: "0 0 90px -20px rgba(52, 211, 153, 0.35)",
  },
]

function LayerCard({
  layer,
  index,
  progress,
  range,
  targetScale,
}: {
  layer: (typeof LAYERS)[number]
  index: number
  progress: MotionValue<number>
  range: [number, number]
  targetScale: number
}) {
  const scale = useTransform(progress, range, [1, targetScale])

  return (
    <div className="sticky top-0 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <motion.div
        style={{ scale, top: `calc(-5vh + ${index * 15 + 200}px)`, boxShadow: layer.glow }}
        className="relative -top-1/4 flex h-[280px] w-[300px] origin-top flex-col overflow-hidden rounded-2xl border border-white/20 bg-black/55 p-8 shadow-2xl sm:h-[320px] sm:w-[400px] sm:rounded-3xl md:h-[340px] md:w-[460px]"
      >
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${layer.chipClass}`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/50">
            current
          </span>
        </div>
        <h3 className="mt-8 text-3xl font-medium text-white">{layer.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/85">{layer.body}</p>
        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-sm font-medium text-white/90">{layer.stat}</span>
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/50">
            layer {String(index + 1).padStart(2, "0")}
          </span>
        </div>
      </motion.div>
    </div>
  )
}

export function ParallaxStack({
  heading = "BUILT FOR EVERY LAYER OF YOUR MONEY",
  subheading = "WALLET · TRENDS · VERDICT",
}: {
  heading?: string
  subheading?: string
}) {
  const container = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  })
  const progress = useSpring(scrollYProgress, {
    mass: 0.12,
    stiffness: 40,
    damping: 26,
  })

  return (
    <section
      id="layers"
      ref={container}
      className="relative flex flex-col items-center justify-center pb-[45vh] pt-[8vh]"
    >
      <div className="px-6 pb-[5vh] text-center">
        <h2 className="text-4xl font-light uppercase tracking-[0.25em] text-white mix-blend-difference md:text-6xl">
          {heading}
        </h2>
        <p className="mt-4 text-sm font-light uppercase tracking-[0.3em] text-white/60 mix-blend-difference">
          {subheading}
        </p>
      </div>

      {LAYERS.map((layer, index) => {
        const targetScale = Math.max(0.6, 1 - (LAYERS.length - index - 1) * 0.08)
        return (
          <LayerCard
            key={layer.id}
            layer={layer}
            index={index}
            progress={progress}
            range={[index * 0.2, 1]}
            targetScale={targetScale}
          />
        )
      })}
    </section>
  )
}
