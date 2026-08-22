"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { ShieldCheck, ArrowLeft, AlertCircle, Sparkles } from "lucide-react";

const ERRORS: Record<string, string> = {
  google_denied: "Google declined the sign-in. Please try again.",
  already_exists:
    "An account with this email already exists — sign in instead.",
  no_account:
    "No Cartis account found with this email — create one instead.",
};

export function AuthUI({ defaultMode = "signin" }: { defaultMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  useEffect(() => {
    const readError = async () => {
      setError(ERRORS[new URLSearchParams(window.location.search).get("error") ?? ""] ?? "");
    };
    void readError();
  }, []);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Soft ambient glow behind the card */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Back to Home button */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-2 text-xs font-medium text-foreground backdrop-blur-md transition-all duration-300 hover:bg-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Home</span>
      </Link>

      {/* Main Card Container */}
      <div className="relative w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-border/50 bg-card p-8 shadow-xl shadow-black/[0.04] sm:p-10"
        >
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="group flex items-center gap-2 transition-transform duration-300 hover:scale-105">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 shadow-sm backdrop-blur-md">
                <span className="text-sm font-black text-primary drop-shadow-sm">C</span>
              </div>
              <MetallicLogo className="h-7 w-24" />
            </Link>

            <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {isSignup ? "Start your journey" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {isSignup
                ? "Get honest purchase verdicts before every checkout."
                : "Real-time balance, budget radar, and price trends."}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-center gap-2 rounded-lg border border-red-200/50 bg-red-50/50 px-3 py-2.5 text-xs text-red-600 dark:text-red-400"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Google Auth */}
          <div className="mt-8">
            <a
              href={`/auth/start?provider=google&intent=${mode}`}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-all duration-300 hover:bg-muted hover:border-border/80"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-1.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
              <span>{isSignup ? "Sign up with Google" : "Continue with Google"}</span>
            </a>
          </div>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Mode Switch */}
          <div className="mt-6 flex flex-col items-center gap-1.5 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isSignup ? "Already have an account?" : "New to Cartis?"}{" "}
              <button
                type="button"
                onClick={() => setMode(isSignup ? "signin" : "signup")}
                className="font-semibold text-primary hover:underline"
              >
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </div>

          {/* Recipe Switch */}
          <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary/70" />
            <p className="text-xs text-muted-foreground">
              {isSignup ? "No credit card required." : "One tap to your dashboard."}
            </p>
          </div>

          {/* Security Footer Badge */}
          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-border/50 pt-5 text-center text-[10px] font-normal text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
            <span>Bank-grade encryption</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}