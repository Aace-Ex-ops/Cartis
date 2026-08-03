"use client"

import { memo, useEffect, useLayoutEffect, useState } from "react"
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from "motion/react"

export interface CarouselItem {
  id: number
  title: string
  body: string
}

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

type UseMediaQueryOptions = {
  defaultValue?: boolean
  initializeWithValue?: boolean
}

const IS_SERVER = typeof window === "undefined"

export function useMediaQuery(
  query: string,
  { defaultValue = false, initializeWithValue = true }: UseMediaQueryOptions = {}
): boolean {
  const getMatches = (query: string): boolean => {
    if (IS_SERVER) {
      return defaultValue
    }
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState<boolean>(() => {
    if (initializeWithValue) {
      return getMatches(query)
    }
    return defaultValue
  })

  const handleChange = () => {
    setMatches(getMatches(query))
  }

  useIsomorphicLayoutEffect(() => {
    const matchMedia = window.matchMedia(query)
    handleChange()

    matchMedia.addEventListener("change", handleChange)

    return () => {
      matchMedia.removeEventListener("change", handleChange)
    }
  }, [query])

  return matches
}

const transitionOverlay = { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const }

const Carousel = memo(
  function Carousel({
    handleClick,
    items,
    isCarouselActive,
    autoRotateSpeed,
  }: {
    handleClick: (index: number) => void
    items: CarouselItem[]
    isCarouselActive: boolean
    autoRotateSpeed: number
  }) {
    const isScreenSizeSm = useMediaQuery("(max-width: 640px)")
    const cylinderWidth = isScreenSizeSm ? 1100 : 1800
    const faceCount = items.length
    const faceWidth = cylinderWidth / faceCount
    const radius = cylinderWidth / (2 * Math.PI)
    const rotation = useMotionValue(0)
    const transform = useTransform(
      rotation,
      (value) => `rotate3d(0, 1, 0, ${value}deg)`
    )
    const [isDragging, setIsDragging] = useState(false)

    useAnimationFrame((_, delta) => {
      if (isCarouselActive && !isDragging) {
        rotation.set(rotation.get() - (delta / 1000) * autoRotateSpeed)
      }
    })

    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <motion.div
          drag={isCarouselActive ? "x" : false}
          className="relative flex h-full origin-center cursor-grab justify-center active:cursor-grabbing"
          style={{
            transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
          onDragStart={() => setIsDragging(true)}
          onDrag={(_, info) =>
            isCarouselActive &&
            rotation.set(rotation.get() + info.offset.x * 0.05)
          }
          onDragEnd={(_, info) => {
            setIsDragging(false)
            if (isCarouselActive) {
              rotation.set(rotation.get() + info.velocity.x * 0.05)
            }
          }}
        >
          {items.map((item, i) => (
            <motion.div
              key={`key-${item.id}-${i}`}
              className="absolute flex h-full origin-center items-center justify-center p-2"
              style={{
                width: `${faceWidth}px`,
                transform: `rotateY(${i * (360 / faceCount)}deg) translateZ(${radius}px)`,
              }}
              onClick={() => handleClick(i)}
            >
              <div className="pointer-events-none flex h-[440px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-white/25 bg-black/40 p-6 text-center shadow-2xl backdrop-blur-xl">
                <span className="text-sm font-light tracking-[0.3em] text-white/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-xl font-medium leading-snug text-white">
                  {item.title}
                </h3>
                <p className="max-w-[240px] text-[13px] leading-relaxed text-white/90">
                  {item.body}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    )
  }
)

export function ThreeDCarousel({
  items,
  autoRotateSpeed = 12,
}: {
  items: CarouselItem[]
  autoRotateSpeed?: number
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isCarouselActive, setIsCarouselActive] = useState(true)

  const handleClick = (index: number) => {
    setActiveIndex(index)
    setIsCarouselActive(false)
  }

  const handleClose = () => {
    setActiveIndex(null)
    setIsCarouselActive(true)
  }

  const activeItem = activeIndex !== null ? items[activeIndex] : null

  return (
    <motion.div layout className="relative">
      <AnimatePresence mode="sync">
        {activeItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md"
            style={{ willChange: "opacity" }}
            transition={transitionOverlay}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }}
              className="w-full max-w-md rounded-2xl border border-white/25 bg-black/50 p-8 text-center shadow-2xl backdrop-blur-xl"
            >
              <span className="text-sm font-light tracking-[0.3em] text-white/50">
                STEP {String(activeIndex! + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                {activeItem.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                {activeItem.body}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative h-[500px] w-full overflow-hidden">
        <Carousel
          handleClick={handleClick}
          items={items}
          isCarouselActive={isCarouselActive}
          autoRotateSpeed={autoRotateSpeed}
        />
      </div>
      <p className="mt-2 text-center text-xs font-light uppercase tracking-[0.3em] text-white/40">
        drag to spin
      </p>
    </motion.div>
  )
}
