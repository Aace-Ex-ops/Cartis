import Link from "next/link";

export function RevnueBrand({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label="Cartis home">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl font-inclusive text-lg font-medium ${
          tone === "dark" ? "bg-[#0C0C0C] text-white" : "bg-white text-[#0C0C0C]"
        }`}
      >
        C
      </span>
      <span
        className={`font-inclusive text-xl font-medium tracking-tight ${
          tone === "dark" ? "text-[#0C0C0C]" : "text-white"
        }`}
      >
        Cartis
      </span>
    </Link>
  );
}
