import { ArrowRight } from "lucide-react";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
          C
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Cartis
        </h1>
        <p className="max-w-md text-base text-muted-foreground">
          Your AI financial coach. Get an honest verdict before every purchase —
          based on your real money, not your impulses.
        </p>
      </div>
      <a
        href={`${GATEWAY}/auth/login?provider=google`}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-emerald-400"
      >
        Continue with Google
        <ArrowRight className="h-4 w-4" />
      </a>
    </main>
  );
}
