"use client"

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"

const TREND_BARS = [35, 55, 40, 65, 50, 78, 60, 86]

const VERDICT_POINTS = [
  { id: 1, label: "Verdict", value: "WAIT — 3 weeks" },
  { id: 2, label: "Budget check", value: "Tab at 82%" },
  { id: 3, label: "Price trend", value: "Falling fast" },
]

export function ThreeDTiltCard({
  heading = "SEE IT BEFORE YOU BUY IT",
  subheading = "THE CARTIS VERDICT",
  description = "Every checkout gets a living verdict — not a popup. Hover the card and watch it answer.",
}: {
  heading?: string
  subheading?: string
  description?: string
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 60, damping: 26 })
  const springY = useSpring(y, { stiffness: 60, damping: 26 })

  const rotateY = useTransform(springX, [-0.5, 0.5], [-22, 22])
  const rotateX = useTransform(springY, [-0.5, 0.5], [16, -16])
  const glareX = useTransform(springX, [-0.5, 0.5], [0, 100])
  const glareY = useTransform(springY, [-0.5, 0.5], [0, 100])
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.22), transparent 65%)`

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - rect.left) / rect.width - 0.5)
    y.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <section id="verdict" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl text-center">
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

      <div className="mt-16 flex justify-center [perspective:1200px]">
        <motion.div
          animate={{ y: [-8, 8] }}
          transition={{
            duration: 5,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        >
          <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            className="relative h-[440px] w-[300px] rounded-3xl border border-white/25 bg-black/40 shadow-2xl backdrop-blur-xl sm:w-[340px]"
          >
            <div
              style={{ transform: "translateZ(60px)" }}
              className="flex h-full flex-col justify-between p-7"
            >
              <div className="flex items-start justify-between">
                <span className="text-lg font-semibold tracking-[0.2em] text-white">
                  CARTIS
                </span>
                <span className="rounded-full border border-white/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/85">
                  live verdict
                </span>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                  Noise Studio Headphones
                </p>
                <p className="mt-2 text-5xl font-light text-white">WAIT</p>
                <p className="mt-1 text-sm text-white/80">
                  price drops expected in ~3 weeks
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                  price trend
                </p>
                <div className="mt-3 flex h-10 items-end gap-1.5">
                  {TREND_BARS.map((height, index) => (
                    <span
                      key={index}
                      style={{ height: `${height}%` }}
                      className={[
                        "w-2 rounded-full",
                        index === TREND_BARS.length - 1
                          ? "bg-gradient-to-t from-teal-300/80 to-white"
                          : "bg-white/50",
                      ].join(" ")}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/75">
                <span>Monthly tab · ₹600</span>
                <span>₹491 used</span>
              </div>
            </div>

            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{ background: glare }}
            />
          </motion.div>
        </motion.div>
      </div>

      <p className="mt-10 text-center text-xs uppercase tracking-[0.3em] text-white/40">
        move your cursor over the card
      </p>

      <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-3">
        {VERDICT_POINTS.map((point) => (
          <div
            key={point.id}
            className="rounded-2xl border border-white/15 bg-black/30 p-5 text-center backdrop-blur-md"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">
              {point.label}
            </p>
            <p className="mt-2 text-sm font-medium text-white">{point.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
