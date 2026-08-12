"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

const ERRORS: Record<string, string> = {
  google_denied:
    "Google declined the sign-in. Please try again or use email sign-in.",
  already_exists:
    "An account with this email already exists — sign in instead.",
  no_account:
    "No Cartis account found with this email — create one instead.",
};

export function SigninForm({ defaultMode = "signin" }: { defaultMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  useEffect(() => {
    const readError = async () => {
      setError(ERRORS[new URLSearchParams(window.location.search).get("error") ?? ""] ?? "");
    };
    void readError();
  }, []);

  const handleOAuth = (provider: "google" | "apple") => {
    setLoading(true);
    setError("");

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "cartis_user_session",
        JSON.stringify({
          id: `${provider}-user-${Date.now()}`,
          email: `aditya.${provider}@cartis.ai`,
          name: "Aditya Sharma",
          avatar: "",
        })
      );
    }

    setTimeout(() => {
      window.location.href = isSignup ? "/onboarding" : "/dashboard";
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Save session locally for localhost dev environment
    if (typeof window !== "undefined") {
      const displayName = name.trim() || email.split("@")[0] || "Aditya Sharma";
      localStorage.setItem(
        "cartis_user_session",
        JSON.stringify({
          id: `user-${Date.now()}`,
          email: email || "preview@cartis.ai",
          name: displayName,
          avatar: "",
        })
      );
    }

    // Simulate auth action / navigate to dashboard after short delay
    setTimeout(() => {
      window.location.href = isSignup ? "/onboarding" : "/dashboard";
    }, 600);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Back to Home button */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-300 hover:bg-muted hover:scale-105"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Home</span>
      </Link>

      {/* Main Card Container */}
      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-lg border border-border/50 bg-card p-6 shadow-sm sm:p-7"
        >
          {/* Header Brand & Mode Switcher */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="group flex items-center gap-2 transition-transform duration-300 hover:scale-105">
              <div className="relative flex h-8 w-8 items-center justify-center rounded border border-primary/20 bg-primary/5 shadow-sm backdrop-blur-md">
                <span className="text-sm font-black text-primary drop-shadow-sm">
                  C
                </span>
              </div>
              <MetallicLogo className="h-7 w-24" />
            </Link>

            {/* Mode Switcher Tabs */}
            <div className="mt-5 flex w-full rounded-md border border-border/50 bg-muted/50 p-0.5 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="relative flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: !isSignup ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
              >
                {!isSignup && (
                  <motion.div
                    layoutId="activeAuthTab"
                    className="absolute inset-0 rounded-md bg-background border border-primary/30 shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="relative flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: isSignup ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
              >
                {isSignup && (
                  <motion.div
                    layoutId="activeAuthTab"
                    className="absolute inset-0 rounded-md bg-background border border-primary/30 shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Create Account</span>
              </button>
            </div>

            <h1 className="mt-5 text-xl font-normal tracking-tight text-foreground sm:text-2xl">
              {isSignup ? "Start your journey" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
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
              className="mt-4 flex items-center gap-2 rounded-md border border-red-200/50 bg-red-50/50 px-3 py-2.5 text-xs text-red-600 dark:text-red-400"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Social Auth Buttons */}
          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2.5 text-xs font-medium text-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-muted hover:scale-[1.02]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2.5 text-xs font-medium text-foreground backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-muted hover:scale-[1.02]"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.67-.82 1.13-1.96.99-3.1-.97.04-2.16.65-2.85 1.46-.62.72-1.16 1.88-.99 3 1.08.08 2.19-.54 2.85-1.36z" />
              </svg>
              <span>Continue with Apple</span>
            </button>
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <AnimatePresence mode="popLayout">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <input
                      type="text"
                      required={isSignup}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aditya Sharma"
                      className="w-full rounded-md border border-border/50 bg-background pl-9 pr-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-md border border-border/50 bg-background pl-9 pr-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                {!isSignup && (
                  <a
                    href="/forgot-password"
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-md border border-border/50 bg-background pl-9 pr-9 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 backdrop-blur-sm transition-all focus:border-primary/50 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Checkbox Options */}
            {!isSignup ? (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border/50 bg-background text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span>Remember me</span>
                </label>
              </div>
            ) : (
              <div className="pt-0.5">
                <label className="flex items-start gap-2 text-[10px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5 rounded border-border/50 bg-background text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="leading-snug">
                    I agree to the{" "}
                    <a href="/terms" className="text-primary underline hover:text-primary/80">
                      Terms
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="text-primary underline hover:text-primary/80">
                      Privacy
                    </a>
                    .
                  </span>
                </label>
              </div>
            )}

            {/* CTA Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative mt-1 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:scale-[1.02] active:scale-95 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
              ) : (
                <>
                  <span>{isSignup ? "Create Free Account" : "Sign In to Cartis"}</span>
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Footer Badge */}
          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-border/50 pt-4 text-center text-[10px] font-normal text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
            <span>Bank-grade encryption</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}