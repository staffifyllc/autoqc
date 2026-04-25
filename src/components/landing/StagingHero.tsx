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
      {/* Warm gradient backdrop — late-afternoon sun through tall windows */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, hsl(28 30% 8%) 0%, hsl(35 35% 14%) 35%, hsl(20 25% 10%) 70%, hsl(0 0% 4%) 100%)",
        }}
      />
      {/* Soft warm beam */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 75% 30%, hsl(35 90% 60% / 0.18) 0%, transparent 45%)",
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
