"use client";

import { motion } from "framer-motion";
import { Sofa, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

// Full-width hero for Virtual Staging. Mirrors the TwilightHero pattern
// but with a warmer "sun through windows" gradient and the six-style
// chip row to make the breadth of options instantly visible.

const STYLES = [
  { label: "Modern", color: "from-slate-400 to-slate-200" },
  { label: "Traditional", color: "from-amber-400 to-orange-300" },
  { label: "Scandinavian", color: "from-blue-200 to-white" },
  { label: "Modern Farmhouse", color: "from-amber-300 to-amber-100" },
  { label: "Mid-Century", color: "from-orange-400 to-amber-200" },
  { label: "Coastal", color: "from-cyan-300 to-blue-200" },
];

export function StagingHero() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      {/* Empty → Furnished gradient story, baked into the background.
          Left side reads "empty room": cool, dim, blue-gray light.
          Right side reads "furnished and lit": warm amber/orange glow.
          The transition in the middle is the moment of staging. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(95deg, hsl(220 18% 9%) 0%, hsl(220 16% 11%) 22%, hsl(30 22% 13%) 55%, hsl(28 38% 16%) 78%, hsl(20 30% 10%) 100%)",
        }}
      />
      {/* Cool window-light suggestion on the empty side (top-left) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 12% 22%, hsl(210 60% 70% / 0.10) 0%, transparent 40%)",
        }}
      />
      {/* Warm interior-lamp glow on the furnished side (right) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 78% 35%, hsl(35 95% 60% / 0.22) 0%, transparent 48%)",
        }}
      />
      {/* Secondary warm pool, low + right, like a side table lamp */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 88% 78%, hsl(28 90% 55% / 0.14) 0%, transparent 32%)",
        }}
      />
      {/* Faint horizontal seam where empty meets furnished, very low opacity */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, transparent 45%, hsl(35 85% 55% / 0.06) 50%, transparent 55%, transparent 100%)",
        }}
      />
      {/* Vignette to keep edges dark and copy floating in the warm middle */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 0%, transparent 55%, hsl(0 0% 0% / 0.45) 100%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] font-mono uppercase tracking-wider mb-6">
            <Sparkles className="w-3 h-3" />
            New · Virtual Staging
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
            Empty rooms.{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg, hsl(35 95% 65%) 0%, hsl(45 95% 75%) 50%, hsl(28 90% 60%) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Furnished, instantly.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Drop in an empty room. Pick a style. Get a photoreal staged
            render in 15 seconds, with the architecture preserved exactly:
            same windows, same doorways, same light. Six styles. Custom
            direction. Optional inspiration upload. Every render is yours.
          </p>

          {/* Style chip row */}
          <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
            {STYLES.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs"
              >
                <span
                  className={`w-2 h-2 rounded-full bg-gradient-to-br ${s.color}`}
                />
                {s.label}
              </div>
            ))}
          </div>

          {/* Pricing pill + CTA */}
          <div className="flex items-center justify-center flex-wrap gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10">
              <Sofa className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-sm">
                <span className="text-amber-200 font-semibold">$2 per room</span>{" "}
                · all 6 styles, any custom direction, keep what you love
              </span>
            </div>
          </div>
          <Link
            href="/dashboard/staging"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 text-black font-semibold hover:opacity-90 transition shadow-lg shadow-amber-500/20"
          >
            Stage a room
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="text-[11px] text-muted-foreground mt-3">
            Architecture preserved exactly · windows + doorways locked ·
            MLS-ready
          </div>
        </motion.div>
      </div>
    </section>
  );
}
