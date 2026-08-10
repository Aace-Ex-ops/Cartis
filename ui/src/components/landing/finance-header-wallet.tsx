"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, Check, X, ArrowUpRight, Send, ChevronDown } from "lucide-react";
import Link from "next/link";
import { MetallicLogo } from "@/components/shared/metallic-logo";

const HEADER_BG_URL = "/landing/videos/astro.mp4";

const NAV_ITEMS = [
  { label: "Sign in", desc: "Back to your dashboard", href: "/signin" },
  { label: "Sign up", desc: "Start free, no card", href: "/signup" },
  { label: "Features", desc: "Finance made smarter", href: "#features" },
  { label: "How it works", desc: "Four steps to smarter money", href: "#how-it-works" },
  { label: "FAQ", desc: "Frequently asked questions", href: "#faq" },
];

export function FinanceHeaderWallet() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let rafId = 0;
    let last = -1;
    const getProgress = () => {
      const el = document.getElementById("scroll-container-wrapper");
      if (!el) return 0;
      const travel = el.offsetHeight - window.innerHeight;
      if (travel <= 0) return 0;
      return Math.min(Math.max(-el.getBoundingClientRect().top / travel, 0), 1);
    };
    const apply = () => {
      rafId = 0;
      const progress = getProgress();
      setScrollProgress(progress);
      const video = videoRef.current;
      if (video && Math.abs(progress - last) > 0.0005) {
        last = progress;
        if (progress >= 0.95) {
          if (video.paused) {
            video.loop = false;
            if (video.currentTime < 4) video.currentTime = 4;
            video.play().catch(() => {});
          }
        } else {
          if (!video.paused) video.pause();
          video.currentTime = 4 * progress;
        }
      }
    };
    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(apply);
    };
    const onTimeUpdate = () => {
      const video = videoRef.current;
      if (video && getProgress() >= 0.95) {
        const duration = video.duration || 0;
        if (video.currentTime >= (duration > 0 ? duration - 0.2 : 4) || video.currentTime < 4) {
          video.currentTime = 4;
          video.play().catch(() => {});
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const video = videoRef.current;
    if (video) {
      video.addEventListener("loadedmetadata", onScroll);
      video.addEventListener("loadeddata", onScroll);
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("ended", onTimeUpdate);
    }
    const initialTimeout = setTimeout(onScroll, 100);
    return () => {
      clearTimeout(initialTimeout);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (video) {
        video.removeEventListener("loadedmetadata", onScroll);
        video.removeEventListener("loadeddata", onScroll);
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ended", onTimeUpdate);
      }
    };
  }, []);

  const rightTextOpacity = Math.min(Math.max((scrollProgress - 0.1) / 0.8, 0), 1);
  const rightTextShift = (1 - rightTextOpacity) * (isMobile ? 30 : 120);

  return (
    <>
      <div
        id="scroll-container-wrapper"
        className="relative w-full h-[250vh] bg-black select-none text-white"
      >
        <div id="hero-sticky-viewport" className="sticky top-0 left-0 w-full h-screen overflow-hidden">
          <video
            ref={videoRef}
            id="bg-video-element"
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-90 transition-opacity duration-1000"
            src={HEADER_BG_URL}
            muted
            playsInline
            loop
          />
          <div className="absolute inset-0 bg-black/35 z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 z-10 pointer-events-none" />
          <style>{`
            @media (min-width: 1024px) {
              .anybody-heading {
                font-size: 70px !important;
                line-height: 1.1 !important;
              }
            }
            @media (min-width: 768px) and (max-width: 1023px) {
              .anybody-heading {
                font-size: 52px !important;
                line-height: 1.1 !important;
              }
            }
            @media (max-width: 767px) {
              .anybody-heading {
                font-size: 34px !important;
                line-height: 1.2 !important;
              }
            }
          `}</style>
          <header
            id="top-nav-bar"
            className="absolute top-0 left-0 right-0 z-30 flex justify-between items-center px-4 md:px-[80px] py-6 md:py-12"
          >
            <div id="wallet-logo-badge" className="flex items-center">
              <Link
                href="/"
                aria-label="Cartis home"
                onClick={(e) => {
                  if (window.location.pathname === "/") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="flex items-center gap-1.5 md:gap-2.5 px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all backdrop-blur-md"
              >
                <MetallicLogo tone="light" className="h-[16px] w-[42px] md:h-[20px] md:w-[52px]" />
              </Link>
            </div>
            <div id="right-side-actions" className="flex items-center gap-2 md:gap-4">
              <button
                id="nav-menu-button"
                onClick={() => setIsDrawerOpen(true)}
                className="p-2.5 md:p-3.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all backdrop-blur-md cursor-pointer flex items-center justify-center"
                aria-label="Open menu"
              >
                <Menu size={isMobile ? 16 : 18} className="text-white" />
              </button>
              <button
                id="contact-us-button"
                onClick={() => setIsContactOpen(true)}
                style={{
                  display: "flex",
                  padding: isMobile ? "10px 14px" : "14px 20px",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "8px",
                  border: "1px solid #404040",
                  background: "#FFF",
                  cursor: "pointer",
                }}
                className="hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] transition-all duration-300"
              >
                <span
                  style={{
                    color: "#0B3A17",
                    fontFamily: "var(--font-anybody), sans-serif",
                    fontSize: isMobile ? "14px" : "18px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "16px",
                  }}
                >
                  Contact Us
                </span>
              </button>
            </div>
          </header>
          <div id="grid-content-body" className="relative w-full h-full z-20">
            <motion.div
              id="left-text-block"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-6 md:left-[80px] top-[140px] md:top-[239px] text-left z-20"
            >
              <div className="relative">
                <h1
                  className="anybody-heading select-none"
                  style={{
                    color: "#FFF",
                    fontFamily: "var(--font-anybody), sans-serif",
                    fontStyle: "normal",
                    fontWeight: 400,
                  }}
                >
                  See the future
                  <br /> of your money.
                </h1>
              </div>
            </motion.div>
            <div
              id="right-text-block"
              style={{
                opacity: rightTextOpacity,
                transform: `translateX(${rightTextShift}px)`,
                transition: "transform 0.15s ease-out, opacity 0.15s ease-out",
              }}
              className="absolute right-6 md:right-[80px] bottom-12 md:bottom-[90px] text-right z-20"
            >
              <h1
                className="anybody-heading select-none"
                style={{
                  color: "#FFF",
                  fontFamily: "var(--font-anybody), sans-serif",
                  fontStyle: "normal",
                  fontWeight: 400,
                }}
              >
                Hold the Future
                <br /> in Your Hands.
              </h1>
            </div>
            <AnimatePresence>
              {!(scrollProgress >= 0.92) && (
                <motion.div
                  key="scroll-indicator"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 font-mono text-[10px] tracking-[0.2em] text-white/40"
                >
                  <span>SCROLL TO EXPLORE</span>
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <ChevronDown size={14} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {isDrawerOpen && (
              <motion.div
                key="drawer-overlay"
                id="drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-end"
              >
                <motion.div
                  id="drawer-panel"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="w-full max-w-md h-full bg-neutral-950 border-l border-white/10 p-8 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
                        <path d="M12 2L2 22h20L12 2zm0 4l6.5 13h-13L12 6z" />
                      </svg>
                      <span className="font-mono tracking-widest text-xs uppercase text-neutral-400">
                        MENU
                      </span>
                    </div>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                      aria-label="Close menu"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <nav className="flex flex-col gap-6 my-auto text-left">
                    {NAV_ITEMS.map((item, i) => (
                      <Link
                        key={i}
                        href={item.href}
                        onClick={() => setIsDrawerOpen(false)}
                        className="group cursor-pointer p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-medium tracking-tight group-hover:text-amber-400 transition-colors">
                            {item.label}
                          </span>
                          <ArrowUpRight
                            size={18}
                            className="text-neutral-500 group-hover:text-white transition-colors"
                          />
                        </div>
                        {item.desc && <p className="text-xs text-neutral-500 mt-1">{item.desc}</p>}
                      </Link>
                    ))}
                  </nav>
                  <div className="border-t border-white/5 pt-6 flex flex-col gap-2 text-xs font-mono text-neutral-500">
                    <div className="flex justify-between">
                      <span>FINANCIAL DATA:</span>
                      <span className="text-emerald-400 animate-pulse">ENCRYPTED</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BANK SYNC:</span>
                      <span>ACTIVE</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isContactOpen && (
              <motion.div
                key="contact-modal-overlay"
                id="contact-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  id="contact-modal-panel"
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative"
                >
                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-semibold tracking-tight">Contact Cartis</h3>
                      <button
                        onClick={() => setIsContactOpen(false)}
                        className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                        aria-label="Close contact form"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {isSubmitted ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 flex flex-col items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                          <Check size={24} />
                        </div>
                        <h4 className="text-lg font-medium">Message sent</h4>
                        <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                          Thanks for reaching out — our team will get back to you shortly.
                        </p>
                      </motion.div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setIsSubmitted(true);
                          setTimeout(() => {
                            setIsSubmitted(false);
                            setIsContactOpen(false);
                            setFormData({ name: "", email: "", message: "" });
                          }, 2500);
                        }}
                        className="flex flex-col gap-4 text-left"
                      >
                        <div>
                          <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                            Your Name
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all text-white placeholder-neutral-600"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                            Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all text-white placeholder-neutral-600"
                            placeholder="you@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                            Message
                          </label>
                          <textarea
                            required
                            rows={4}
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all text-white placeholder-neutral-600 resize-none"
                            placeholder="How can we help?"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full flex justify-center items-center gap-2 py-3.5 px-4 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-all active:scale-[0.98] cursor-pointer mt-2"
                        >
                          <Send size={16} />
                          <span className="text-sm">Send Message</span>
                        </button>
                      </form>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
