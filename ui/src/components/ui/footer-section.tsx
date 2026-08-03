"use client";

import { useState } from "react";
import { MetallicLogo } from "@/components/shared/metallic-logo";
import { Send, ShieldCheck } from "lucide-react";

function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function FooterSection() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="relative border-t border-white/10 bg-black/50 pt-16 pb-10 text-white backdrop-blur-2xl">
      {/* Background glow effects */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-teal-500/10 blur-[100px]" />
        <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8 pb-12 border-b border-white/10">
          {/* Brand & Newsletter Column */}
          <div className="lg:col-span-4 space-y-6">
            <a href="/" className="inline-flex items-center gap-3 group">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/40 bg-gradient-to-br from-teal-400/25 via-emerald-500/15 to-black/60 shadow-[0_0_16px_-3px_rgba(45,212,191,0.4)] backdrop-blur-md transition-all duration-300 group-hover:border-teal-200/70">
                <span className="text-lg font-black text-teal-100 drop-shadow-[0_0_8px_rgba(45,212,191,0.9)]">
                  C
                </span>
              </div>
              <MetallicLogo className="h-[32px] w-[110px]" />
            </a>

            <p className="text-sm font-light leading-relaxed text-white/70 max-w-sm">
              Know before you spend. Real-time financial guardrails, price trend tracking,
              and honest purchase verdicts before every checkout.
            </p>

            {/* Newsletter Form */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-200">
                STAY UPDATED
              </p>
              {subscribed ? (
                <div className="flex items-center gap-2 text-sm text-teal-300 bg-teal-500/10 border border-teal-400/30 rounded-xl px-4 py-3">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>You're on the list! Check your inbox soon.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300"
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex items-center justify-center rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-teal-200 hover:scale-105 active:scale-95 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {[
                { icon: TwitterIcon, href: "https://twitter.com", label: "Twitter" },
                { icon: GithubIcon, href: "https://github.com", label: "GitHub" },
                { icon: LinkedinIcon, href: "https://linkedin.com", label: "LinkedIn" },
                { icon: InstagramIcon, href: "https://instagram.com", label: "Instagram" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/70 backdrop-blur-sm transition-all hover:border-teal-300/40 hover:bg-teal-300/10 hover:text-teal-200"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation Links Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {/* Product */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-white">
                PRODUCT
              </h3>
              <ul className="space-y-2.5 text-sm font-light text-white/70">
                <li><a href="#verdict" className="transition-colors hover:text-teal-200">Honest Verdicts</a></li>
                <li><a href="#features" className="transition-colors hover:text-teal-200">Budget Radar</a></li>
                <li><a href="#budget" className="transition-colors hover:text-teal-200">Monthly Tabs</a></li>
                <li><a href="#how" className="transition-colors hover:text-teal-200">Quad-Choice Checkout</a></li>
                <li><a href="/dashboard" className="transition-colors hover:text-teal-200">AI Twin Coach</a></li>
              </ul>
            </div>

            {/* Merchants */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-white">
                MERCHANTS
              </h3>
              <ul className="space-y-2.5 text-sm font-light text-white/70">
                <li><a href="/seller/dashboard" className="transition-colors hover:text-teal-200">Seller Hub</a></li>
                <li><a href="/seller/inventory" className="transition-colors hover:text-teal-200">Dynamic Pricing</a></li>
                <li><a href="/seller/cashflow" className="transition-colors hover:text-teal-200">Sponsored Tab</a></li>
                <li><a href="/seller/pnl" className="transition-colors hover:text-teal-200">Financial P&amp;L</a></li>
                <li><a href="/seller/coach" className="transition-colors hover:text-teal-200">Merchant AI</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-white">
                RESOURCES
              </h3>
              <ul className="space-y-2.5 text-sm font-light text-white/70">
                <li><a href="#" className="transition-colors hover:text-teal-200">Browser Extension</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Plaid Open Banking</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">API Documentation</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Security &amp; Ledger</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Help Center</a></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-white">
                COMPANY
              </h3>
              <ul className="space-y-2.5 text-sm font-light text-white/70">
                <li><a href="#" className="transition-colors hover:text-teal-200">About Cartis</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Careers</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Press Kit</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Privacy Policy</a></li>
                <li><a href="#" className="transition-colors hover:text-teal-200">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-light text-white/60">
          <div className="flex flex-wrap items-center gap-6">
            <span>&copy; {new Date().getFullYear()} Cartis Inc. All rights reserved.</span>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium">All Systems Operational</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-white">Privacy</a>
            <a href="#" className="transition-colors hover:text-white">Terms</a>
            <a href="#" className="transition-colors hover:text-white">Cookies</a>
            <a href="#" className="transition-colors hover:text-white">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
