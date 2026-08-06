import { LandingAuth } from "@/components/shared/landing-auth";
import { AuthAwareLink } from "@/components/shared/auth-aware-link";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { Warp } from "@paper-design/shaders-react";
import { FloatingCoins } from "@/components/ui/floating-coins";
import { InteractiveAccordion, type AccordionItem } from "@/components/ui/interactive-accordion";
import { ParallaxStack } from "@/components/ui/parallax-stack";
import { StickyStory } from "@/components/ui/sticky-story";
import { ThreeDCarousel, type CarouselItem } from "@/components/ui/three-d-carousel";
import { ThreeDTiltCard } from "@/components/ui/three-d-tilt-card";
import { FooterSection } from "@/components/ui/footer-section";

const FEATURE_ITEMS: AccordionItem[] = [
  { id: 1, title: "Honest verdicts before checkout", body: "Cartis checks price, budget, and urgency against your real money — then tells you to buy, wait, or walk away. No fluff, no affiliate bias." },
  { id: 2, title: "Budget awareness built in", body: "Monthly tab limits, wallet balance, and overspend alerts that fire before the damage — not after the statement arrives." },
  { id: 3, title: "Every purchase tracked", body: "Analysis history, price trends, and spending patterns you can actually act on. Your money, structured." },
  { id: 4, title: "Price trends you can act on", body: "Watch how prices move over time and time your purchases to get the best value." },
  { id: 5, title: "Wallet balance checks", body: "Cartis reads your real wallet before every purchase, so you never spend blind." },
  { id: 6, title: "Overspend alerts that fire early", body: "Warnings that arrive before the damage — not after the statement lands." },
];

const STEP_ITEMS: CarouselItem[] = [
  { id: 1, title: "Install the extension", body: "Works on Amazon, Flipkart, and Best Buy. No accounts to configure, no data to hand over." },
  { id: 2, title: "Shop like normal", body: "Browse products as you always do. Cartis watches the page quietly in the background." },
  { id: 3, title: "Get an honest verdict", body: "Buy / Wait / Avoid — with a plain-English reason tied to your real budget." },
  { id: 4, title: "Read the plain-English reason", body: "Every verdict comes with a short, honest explanation you can act on." },
  { id: 5, title: "Track the trend", body: "See how prices move over time and let Cartis time your next purchase." },
  { id: 6, title: "Stay on budget", body: "Monthly tab limits keep your spending honest, purchase after purchase." },
];

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="fixed inset-0 z-0">
        <Warp
          style={{ height: "100%", width: "100%" }}
          proportion={0.45}
          softness={1}
          distortion={0.25}
          swirl={0.8}
          swirlIterations={10}
          shape="checks"
          shapeScale={0.1}
          scale={1}
          rotation={0}
          speed={1}
          colors={[
            "hsl(200, 100%, 20%)",
            "hsl(160, 100%, 75%)",
            "hsl(180, 90%, 30%)",
            "hsl(170, 100%, 80%)",
          ]}
        />
      </div>

      <div className="relative z-10">
        <header className="flex h-20 items-center justify-between px-6 md:h-24 md:px-12">
          <a
            href="/"
            className="group flex items-center gap-3.5 transition-transform duration-300 hover:scale-[1.02]"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-teal-300/40 bg-gradient-to-br from-teal-400/25 via-emerald-500/15 to-black/60 shadow-[0_0_20px_-3px_rgba(45,212,191,0.4)] backdrop-blur-md transition-all duration-300 group-hover:border-teal-200/70 group-hover:shadow-[0_0_28px_2px_rgba(45,212,191,0.6)] md:h-12 md:w-12">
              <span className="text-xl font-black text-teal-100 drop-shadow-[0_0_10px_rgba(45,212,191,0.9)] md:text-2xl">
                C
              </span>
              <div className="absolute inset-0 rounded-xl bg-teal-300/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <div className="flex items-center gap-2">
              <MetallicLogo className="h-[38px] w-[125px] md:h-[46px] md:w-[150px]" />
              <span className="rounded-full border border-teal-300/40 bg-teal-300/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.3)]">
                AI
              </span>
            </div>
          </a>
          <LandingAuth />
        </header>

        <section className="flex min-h-screen items-center justify-center px-8">
          <div className="w-full max-w-4xl space-y-8 text-center">
            <h1 className="text-balance text-5xl font-light text-white md:text-7xl">
              Know before you spend.
            </h1>
            <p className="mx-auto max-w-3xl text-xl font-light leading-relaxed text-white/90 md:text-2xl">
              Cartis reads your real money — wallet, budget, spending pace — and gives
              you an honest verdict before every purchase. No lectures. Just the truth.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <AuthAwareLink
                href="/signup"
                signedInLabel="Go to dashboard"
                className="rounded-full border border-white/30 bg-white/20 px-8 py-4 font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
              >
                Get started free
              </AuthAwareLink>
              <a
                href="#how"
                className="rounded-full bg-white px-8 py-4 font-medium text-gray-800 transition-transform duration-300 hover:scale-105"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        <StickyStory />

        <ThreeDTiltCard />

        <section id="features" className="relative px-6 py-24 md:py-32">
          <InteractiveAccordion
            items={FEATURE_ITEMS}
            heading="WHY CARTIS"
            subheading="FEATURES"
            description="Six reasons your wallet will love Cartis — honest verdicts, real budgets, price trends, and early warnings, all built around your money."
            ctaHref="/signup"
            ctaLabel="Get started free"
          />
        </section>

        <ParallaxStack />

        <section id="how" className="relative px-6 py-24 md:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-4xl font-light uppercase tracking-[0.25em] text-white mix-blend-difference md:text-6xl">
              HOW IT WORKS
            </h2>
            <p className="mt-4 text-sm font-light uppercase tracking-[0.3em] text-white/60 mix-blend-difference">
              STEPS
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-6xl">
            <ThreeDCarousel items={STEP_ITEMS} />
          </div>
        </section>

        <FloatingCoins />

        <main className="mx-auto w-full max-w-5xl px-6">
          <section className="relative mb-20 overflow-hidden rounded-3xl border border-white/20 bg-white/10 px-6 py-14 text-center backdrop-blur-sm">
            <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Stop buying on impulse.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70">
              Your future self will thank your wallet. Join Cartis and get an honest
              answer before every purchase.
            </p>
            <div className="mt-8 flex justify-center">
              <AuthAwareLink
                href="/signup"
                signedInLabel="Go to dashboard"
                className="rounded-full bg-white px-8 py-4 font-medium text-gray-800 transition-transform duration-300 hover:scale-105"
              >
                Get started free
              </AuthAwareLink>
            </div>
          </section>
        </main>

        <FooterSection />
      </div>
    </div>
  );
}
