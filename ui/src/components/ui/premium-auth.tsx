"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Warp } from "@paper-design/shaders-react";
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
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
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
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.67-.82 1.13-1.96.99-3.1-.97.04-2.16.65-2.85 1.46-.62.72-1.16 1.88-.99 3 1.08.08 2.19-.54 2.85-1.36z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  google_denied:
    "Google declined the sign-in. Please try again or use email sign-in.",
  already_exists:
    "An account with this email already exists — sign in instead.",
  no_account:
    "No Cartis account found with this email — create one instead.",
};

export function PremiumAuth({ defaultMode = "signin" }: { defaultMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  useEffect(() => {
    setError(ERRORS[new URLSearchParams(window.location.search).get("error") ?? ""] ?? "");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate auth action / navigate to dashboard after short delay
    setTimeout(() => {
      window.location.href = isSignup ? "/onboarding" : "/dashboard";
    }, 900);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Floating Back to Home button */}
      <a
        href="/"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition-all duration-300 hover:border-teal-300/40 hover:bg-white/20 hover:scale-105"
      >
        <ArrowLeft className="h-4 w-4 text-teal-200" />
        <span>Back to home</span>
      </a>
      {/* Background Warp Shader - Exactly like landing page */}
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

      {/* Main Glass Card Container */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-white/20 bg-black/45 p-7 shadow-[0_0_80px_-15px_rgba(45,212,191,0.25)] backdrop-blur-2xl sm:p-9"
        >
          {/* Header Brand & Mode Switcher */}
          <div className="flex flex-col items-center text-center">
            <a href="/" className="group flex items-center gap-3 transition-transform duration-300 hover:scale-105">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-teal-300/40 bg-gradient-to-br from-teal-400/25 via-emerald-500/15 to-black/60 shadow-[0_0_16px_-3px_rgba(45,212,191,0.4)] backdrop-blur-md">
                <span className="text-xl font-black text-teal-100 drop-shadow-[0_0_8px_rgba(45,212,191,0.9)]">
                  C
                </span>
              </div>
              <MetallicLogo className="h-[36px] w-[120px]" />
            </a>

            {/* Mode Switcher Tabs */}
            <div className="mt-7 flex w-full rounded-2xl border border-white/15 bg-white/5 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="relative flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors"
                style={{ color: !isSignup ? "#ffffff" : "rgba(255, 255, 255, 0.6)" }}
              >
                {!isSignup && (
                  <motion.div
                    layoutId="activeAuthTab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400/30 to-emerald-400/20 border border-teal-300/40 shadow-[0_0_12px_rgba(45,212,191,0.3)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="relative flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors"
                style={{ color: isSignup ? "#ffffff" : "rgba(255, 255, 255, 0.6)" }}
              >
                {isSignup && (
                  <motion.div
                    layoutId="activeAuthTab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400/30 to-emerald-400/20 border border-teal-300/40 shadow-[0_0_12px_rgba(45,212,191,0.3)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Create Account</span>
              </button>
            </div>

            <h1 className="mt-6 text-2xl font-light tracking-tight text-white sm:text-3xl">
              {isSignup ? "Start your journey" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70">
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
              className="mt-5 flex items-center gap-2.5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Social Auth Buttons */}
          <div className="mt-6 space-y-2.5">
            <a
              href={`/auth/start?provider=google&intent=${mode}`}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/15 hover:scale-[1.01]"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </a>
            <a
              href={`/auth/start?provider=apple&intent=${mode}`}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/15 hover:scale-[1.01]"
            >
              <AppleIcon />
              <span>Continue with Apple</span>
            </a>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/15" />
            <span className="text-[11px] font-light uppercase tracking-[0.25em] text-white/50">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-white/15" />
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input
                      type="text"
                      required={isSignup}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aditya Sharma"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 backdrop-blur-md transition-all focus:border-teal-300 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-teal-300"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 backdrop-blur-md transition-all focus:border-teal-300 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-teal-300"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  Password
                </label>
                {!isSignup && (
                  <a
                    href="/forgot-password"
                    className="text-xs text-teal-300 hover:text-teal-200 transition-colors"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 pl-10 pr-11 py-3 text-sm text-white placeholder-white/30 backdrop-blur-md transition-all focus:border-teal-300 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-teal-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox Options */}
            {!isSignup ? (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-teal-400 focus:ring-teal-400 focus:ring-offset-0"
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>
            ) : (
              <div className="pt-1">
                <label className="flex items-start gap-2.5 text-xs text-white/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-white/10 text-teal-400 focus:ring-teal-400 focus:ring-offset-0"
                  />
                  <span className="leading-snug">
                    I agree to the{" "}
                    <a href="/terms" className="text-teal-300 underline hover:text-teal-200">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="text-teal-300 underline hover:text-teal-200">
                      Privacy Policy
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
              className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-gray-900 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:bg-teal-200 active:scale-95 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-900" />
              ) : (
                <>
                  <span>{isSignup ? "Create Free Account" : "Sign In to Cartis"}</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Security Footer Badge */}
          <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-center text-[11px] font-light text-white/60">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Bank-grade 256-bit encryption · Plaid Open-Banking Verified</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
