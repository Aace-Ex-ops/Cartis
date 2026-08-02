"use client";

import MetallicPaint from "@/components/shared/metallic-paint";

export function MetallicLogo({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-block shrink-0 ${className}`}>
      <MetallicPaint
        imageSrc="/cartis-wordmark.svg"
        seed={42}
        scale={4}
        patternSharpness={1}
        noiseScale={0.5}
        speed={0.3}
        liquid={0.75}
        brightness={2}
        contrast={0.5}
        refraction={0.01}
        blur={0.015}
        chromaticSpread={2}
        fresnel={1}
        lightColor="#ffffff"
        darkColor="#101010"
        tintColor="#34d399"
      />
    </span>
  );
}
