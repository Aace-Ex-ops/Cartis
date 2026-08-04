"use client"

import { useState } from "react"
import { AuthAwareCta } from "@/components/shared/auth-aware-cta"

export interface AccordionItem {
  id: number
  title: string
  body: string
}

function AccordionItemView({
  item,
  index,
  isActive,
  onMouseEnter,
}: {
  item: AccordionItem
  index: number
  isActive: boolean
  onMouseEnter: () => void
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] cursor-pointer",
        isActive
          ? "h-[260px] w-full md:h-[450px] md:w-[400px]"
          : "h-[70px] w-full md:h-[450px] md:w-[60px]",
      ].join(" ")}
      onMouseEnter={onMouseEnter}
      onFocus={onMouseEnter}
      role="button"
      tabIndex={0}
    >
      <div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-xl" />
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 transition-opacity duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          isActive ? "opacity-100" : "opacity-70",
        ].join(" ")}
      />
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 border rounded-2xl transition-colors duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          isActive ? "border-white/30" : "border-white/15",
        ].join(" ")}
      />

      <span
        className={[
          "pointer-events-none absolute font-medium text-white whitespace-nowrap transition-all duration-300 ease-in-out",
          isActive
            ? "bottom-6 left-1/2 -translate-x-1/2 rotate-0 text-lg opacity-0"
            : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-sm uppercase tracking-[0.2em] text-white/90 opacity-100 md:top-auto md:bottom-24 md:translate-y-0 md:text-xs",
        ].join(" ")}
      >
        {item.title}
      </span>

      <div
        className={[
          "absolute inset-0 flex flex-col justify-end p-6 transition-opacity duration-500",
          isActive ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <span className="text-5xl font-light text-white/40">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="mt-2 text-2xl font-semibold text-white">{item.title}</h3>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/90">
          {item.body}
        </p>
      </div>
    </div>
  )
}

export function InteractiveAccordion({
  items,
  heading = "WHY CARTIS",
  subheading = "FEATURES",
  description,
  ctaHref = "/signup",
  ctaLabel = "Get started free",
}: {
  items: AccordionItem[]
  heading?: string
  subheading?: string
  description?: string
  ctaHref?: string | null
  ctaLabel?: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="flex flex-col items-center gap-12 lg:flex-row">
      <div className="w-full text-center lg:w-1/2 lg:text-left">
        <h2 className="text-4xl font-light uppercase tracking-[0.25em] text-white mix-blend-difference md:text-6xl">
          {heading}
        </h2>
        <p className="mt-4 text-sm font-light uppercase tracking-[0.3em] text-white/60 mix-blend-difference">
          {subheading}
        </p>
        {description && (
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/70 lg:mx-0">
            {description}
          </p>
        )}
        <div className="mt-8 flex justify-center lg:justify-start">
          {ctaHref ? (
            <a
              href={ctaHref}
              className="rounded-full bg-white px-8 py-4 font-medium text-gray-800 transition-transform duration-300 hover:scale-105"
            >
              {ctaLabel}
            </a>
          ) : (
            <AuthAwareCta className="rounded-full bg-white px-8 py-4 font-medium text-gray-800 transition-transform duration-300 hover:scale-105" />
          )}
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-white/40">
          hover a panel to expand
        </p>
      </div>

      <div className="w-full lg:w-1/2">
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
          {items.map((item, index) => (
            <AccordionItemView
              key={item.id}
              item={item}
              index={index}
              isActive={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
