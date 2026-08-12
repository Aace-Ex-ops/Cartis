"use client";

import { useEffect, useState } from "react";

export function CursorGradient() {
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: -1000,
    y: -1000,
  });
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setOpacity(1);
    };

    const handleMouseLeave = () => {
      setOpacity(0);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.body.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 ease-out"
      style={{ opacity }}
    >
      {/* Primary Radial Glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-transform duration-75 ease-out"
        style={{
          background: `radial-gradient(650px circle at ${position.x}px ${position.y}px, rgba(45, 212, 191, 0.14), rgba(16, 185, 129, 0.05) 45%, transparent 75%)`,
        }}
      />
      {/* Secondary Accent Core */}
      <div
        className="pointer-events-none absolute inset-0 transition-transform duration-100 ease-out"
        style={{
          background: `radial-gradient(300px circle at ${position.x}px ${position.y}px, rgba(56, 189, 248, 0.08), transparent 70%)`,
        }}
      />
    </div>
  );
}