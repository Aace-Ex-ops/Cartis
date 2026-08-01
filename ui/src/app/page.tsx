import { ArrowRight, Sparkles, Wallet, LineChart, MousePointerClick, ShoppingCart, CheckCircle2 } from "lucide-react";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

const STATS = [
  { value: "3", label: "marketplaces covered" },
  { value: "<10s", label: "verdict, not a lecture" },
  { value: "₹600", label: "default monthly tab limit" },
  { value: "100%", label: "of purchases tracked" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Honest verdicts before checkout",
    body: "Cartis checks price, budget, and urgency against your real money — then tells you to buy, wait, or walk away. No fluff, no affiliate bias.",
  },
  {
    icon: Wallet,
    title: "Budget awareness built in",
    body: "Monthly tab limits, wallet balance, and overspend alerts that fire before the damage — not after the statement arrives.",
  },
  {
    icon: LineChart,
    title: "Every purchase tracked",
    body: "Analysis history, price trends, and spending patterns you can actually act on. Your money, structured.",
  },
];

const STEPS = [
  { icon: MousePointerClick, title: "Install the extension", body: "Works on Amazon, Flipkart, and Best Buy. No accounts to configure, no data to hand over." },
  { icon: ShoppingCart, title: "Shop like normal", body: "Browse products as you always do. Cartis watches the page quietly in the background." },
  { icon: CheckCircle2, title: "Get an honest verdict", body: "Buy / Wait / Avoid — with a plain-English reason tied to your real budget." },
];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10%, rgba(16,185,129,0.12), transparent 60%), radial-gradient(40rem 20rem at 85% 15%, rgba(16,185,129,0.05), transparent 60%)",
        }}
      />

      <header className="relative z-10 flex h-16 items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            C
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Cartis</span>
        </div>
        <a
          href={`${GATEWAY}/auth/login?provider=google`}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
        >
          Continue with Google
        </a>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="flex flex-col items-center pt-20 pb-16 text-center md:pt-28">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI financial coach
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Know before you <span className="text-primary">spend</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Cartis reads your real money — wallet, budget, spending pace — and gives
            you an honest verdict before every purchase. No lectures. Just the truth.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href={`${GATEWAY}/auth/login?provider=google`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </a>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 bg-card px-4 py-8 text-center">
              <span className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">{s.value}</span>
              <span className="text-[13px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </section>

        <section className="grid gap-4 py-20 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevated text-primary transition-colors group-hover:bg-primary/10">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="how" className="pb-20">
          <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight md:text-3xl">
            How it works
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6">
                <span className="absolute right-5 top-5 text-4xl font-semibold text-elevated">{i + 1}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevated text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mb-20 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent px-6 py-14 text-center">
          <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">
            Stop buying on impulse.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your future self will thank your wallet. Join Cartis and get an honest
            answer before every purchase.
          </p>
          <a
            href={`${GATEWAY}/auth/login?provider=google`}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Continue with Google
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/50 px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-[13px] text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Cartis</span>
          <div className="flex gap-6">
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
