import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnboardingForm } from "@/components/shared/onboarding-form";
import { MetallicLogo } from "@/components/shared/metallic-logo";

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[12px] font-bold text-primary-foreground">
              C
            </div>
            <span className="text-sm font-semibold">
              <MetallicLogo className="h-[16px] w-[52px]" />
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect your bank in 2 minutes
        </h1>
        <p className="mb-8 mt-1.5 text-sm text-muted-foreground">
          Pick your bank, tap a link, and your transactions start flowing in.
        </p>

        <OnboardingForm />
      </div>
    </main>
  );
}
