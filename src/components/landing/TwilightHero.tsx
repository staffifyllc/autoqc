"use client";

import { motion } from "framer-motion";
import { Moon, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

// Full-width hero section dedicated to Virtual Twilight. Animated dusk
// gradient background, drifting stars, gradient title, bold pricing
// callout. Sits between the feature grid and the next demo section so it
// catches every visitor who scrolls past the feature list.

const STARS = Array.from({ length: 18 }, (_, i) => ({
  top: `${Math.random() * 70 + 5}%`,
  left: `${Math.random() * 95 + 2}%`,
  size: Math.random() * 2 + 1,
  delay: Math.random() * 3,
}));

export function TwilightHero() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      {/* Animated gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 dusk-gradient opacity-90"
      />
      {/* Soft radial vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, transparent 0%, transparent 30%, hsl(0 0% 0% / 0.35) 100%)",
        }}
      />
      {/* Drifting stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute rounded-full bg-white twinkle pointer-events-none"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      <div className="relative max-w-5xl mx-auto px-6 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center space-y-8"
        >
          <div className="flex items-center justify-center gap-2">
            <div className="shimmer-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-200/40 text-amber-100 text-[11px] font-mono uppercase tracking-[0.2em] backdrop-blur-sm bg-white/5">
              <Sparkles className="w-3 h-3" />
              New Add-on
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.95] twilight-title">
              Virtual Twilight.
            </h2>
            <p className="text-xl md:text-2xl text-white/85 max-w-2xl mx-auto font-light tracking-tight leading-snug">
              Any daytime exterior. Transformed into a dramatic dusk scene.
              Preview free. Keep it for a dollar.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <Moon className="w-4 h-4 text-amber-200" />
              <span className="text-sm text-white/90">
                Exterior photos only
              </span>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-300/30 backdrop-blur-md">
              <span className="text-2xl font-bold text-amber-100">$1</span>
              <span className="text-sm text-white/85">per photo</span>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span className="text-sm text-white/90">
                Architecture preserved
              </span>
            </div>
          </div>

          <div className="pt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-amber-100 transition shadow-[0_0_40px_-5px_hsl(45_100%_70%/0.5)]"
            >
              Try Virtual Twilight
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/25 text-white/90 font-medium text-sm hover:bg-white/10 transition"
            >
              See pricing
            </Link>
          </div>

          <p className="text-[11px] font-mono uppercase tracking-wider text-white/55 pt-2">
            No fake skies. No added elements. MLS-ethical.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
