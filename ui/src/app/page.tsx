import "@/components/landing/landing.css";
import { FinanceHeaderWallet } from "@/components/landing/finance-header-wallet";
import { FinanceHeaderAynaz } from "@/components/landing/finance-header-aynaz";
import { RevnueHero } from "@/components/landing/revnue-hero";
import { RevnuePartners } from "@/components/landing/revnue-partners";
import { RevnueCapabilities } from "@/components/landing/revnue-capabilities";
import { RevnueHowItWorks } from "@/components/landing/revnue-how-it-works";
import { RevnueTestimonials } from "@/components/landing/revnue-testimonials";
import { RevnueOverview } from "@/components/landing/revnue-overview";
import { RevnueFaq } from "@/components/landing/revnue-faq";
import { RevnueFooter } from "@/components/landing/revnue-footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#0C0C0C]">
      <FinanceHeaderWallet />
      <RevnueHero />
      <RevnuePartners />
      <RevnueCapabilities />
      <RevnueHowItWorks />
      <div className="h-16 md:h-24 bg-gradient-to-b from-white to-[#0C0C0C]" />
      <RevnueTestimonials />
      <RevnueOverview />
      <FinanceHeaderAynaz />
      <RevnueFaq />
      <RevnueFooter />
    </main>
  );
}
