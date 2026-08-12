import "@/components/landing/landing.css";
import { FinanceHeaderWallet } from "@/components/landing/finance-header-wallet";
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
      <RevnueTestimonials />
      <RevnueOverview />
      <RevnueFaq />
      <RevnueFooter />
    </main>
  );
}
