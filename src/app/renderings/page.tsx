"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowDown,
  Sparkles,
  Layers,
  Sun,
  Moon,
  ArrowRight,
  Zap,
  CheckCircle2,
  Wand2,
  Camera,
  Eye,
} from "lucide-react";

// ─── HERO ─────────────────────────────────────────────────────────────────
// 200vh section with a pinned 100vh stage. As the visitor scrolls through
// the section, the "before" image fades to the "after" image and a giant
// gradient headline unmasks itself, finishing with a scroll prompt.
function CinemaHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const afterOpacity = useTransform(scrollYProgress, [0.0, 0.6], [0, 1]);
  const afterClip = useTransform(
    scrollYProgress,
    [0.0, 0.6],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );
  const beforeBlur = useTransform(scrollYProgress, [0.0, 0.7], [0, 6]);
  const beforeFilter = useTransform(
    beforeBlur,
    (b) => `blur(${b}px) saturate(${1 - Number(scrollYProgress.get()) * 0.4})`,
  );
  const headlineY = useTransform(scrollYProgress, [0, 0.5], [0, -120]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.35, 0.55], [1, 1, 0.2]);
  const scrollPromptOpacity = useTransform(scrollYProgress, [0, 0.05, 0.4], [0, 1, 0]);

  return (
    <section
      ref={ref}
      className="relative h-[200vh] bg-black"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Before image — gets desaturated as you scroll */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/demos/kitchen-before.jpg)',
            filter: beforeFilter,
          }}
        />
        {/* After image — wipes in left to right */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/demos/kitchen-after.jpg)',
            opacity: afterOpacity,
            clipPath: afterClip,
          }}
        />
        {/* Dark gradient overlay so headline stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/85" />

        {/* Headline */}
        <motion.div
          className="relative h-full flex flex-col items-center justify-center px-6"
          style={{ y: headlineY, opacity: headlineOpacity }}
        >
          <p className="text-[11px] font-mono uppercase tracking-[4px] text-emerald-400/80 mb-5">
            Renderings · AutoQC
          </p>
          <h1 className="text-center text-white font-extrabold leading-[0.95] tracking-tight text-[clamp(46px,9vw,120px)] max-w-5xl">
            <span className="block">Raw upload.</span>
            <span className="block bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Delivered in seconds.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-center text-white/70 text-base md:text-lg">
            Color, verticals, staging, twilight, distractions. Watch what
            happens between drop and download.
          </p>
        </motion.div>

        {/* Scroll prompt */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/60 text-[11px] font-mono uppercase tracking-[3px]"
          style={{ opacity: scrollPromptOpacity }}
        >
          Keep scrolling
          <ArrowDown className="w-3.5 h-3.5 mt-2 animate-bounce" />
        </motion.div>
      </div>
    </section>
  );
}

// ─── COLOR STORY ───────────────────────────────────────────────────────────
// "Before" stays still; "after" sweeps in from the right with a clip wipe.
// Caption chips animate in on the right side as the after-state lands.
function ColorStorySection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 30%"],
  });

  const afterClip = useTransform(
    scrollYProgress,
    [0.1, 0.6],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );
  const seamX = useTransform(scrollYProgress, [0.1, 0.6], ["0%", "100%"]);
  const seamOpacity = useTransform(
    scrollYProgress,
    [0.08, 0.12, 0.58, 0.62],
    [0, 1, 1, 0],
  );

  const fixes = [
    { label: "Verticals", delay: 0.0, color: "from-emerald-500/30 to-emerald-500/0" },
    { label: "Color cast", delay: 0.08, color: "from-emerald-500/30 to-emerald-500/0" },
    { label: "Exposure", delay: 0.16, color: "from-emerald-500/30 to-emerald-500/0" },
    { label: "Clarity", delay: 0.24, color: "from-emerald-500/30 to-emerald-500/0" },
    { label: "Window blowout", delay: 0.32, color: "from-emerald-500/30 to-emerald-500/0" },
  ];

  return (
    <section className="relative bg-black py-32 md:py-44 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-mono uppercase tracking-[4px] text-emerald-400/80 mb-4"
        >
          01 / The Color Story
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-white text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight max-w-3xl"
        >
          What the camera saw{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
            vs what gets delivered.
          </span>
        </motion.h2>

        <div
          ref={ref}
          className="mt-16 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start"
        >
          {/* Image stack */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-[0_30px_120px_-30px_rgba(16,185,129,0.4)]">
            <img
              src="/demos/kitchen-before.jpg"
              alt="Raw kitchen"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <motion.img
              src="/demos/kitchen-after.jpg"
              alt="AutoQC processed kitchen"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ clipPath: afterClip }}
            />
            {/* Scan seam */}
            <motion.div
              className="absolute top-0 bottom-0 w-[2px]"
              style={{
                left: seamX,
                opacity: seamOpacity,
                background:
                  "linear-gradient(180deg,transparent 0%,#34d399 30%,#34d399 70%,transparent 100%)",
                boxShadow: "0 0 22px 4px rgba(52,211,153,0.7)",
              }}
            />
            {/* Stage labels */}
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-white/80">
              Raw
            </div>
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-emerald-200 border border-emerald-500/40">
              Delivered
            </div>
          </div>

          {/* Caption chips */}
          <div className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-[3px] text-white/40 mb-4">
              Auto-fixes applied
            </p>
            {fixes.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: f.delay }}
                className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] backdrop-blur"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${f.color} pointer-events-none`}
                />
                <div className="relative px-4 py-3 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-white text-sm font-medium">{f.label}</span>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-emerald-300/70">
                    auto
                  </span>
                </div>
              </motion.div>
            ))}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-white/40 text-xs leading-relaxed pt-3"
            >
              14 checks per photo. Auto-fix tolerance keeps natural shots
              natural. Anything beyond tolerance gets flagged for human
              review.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FURNITURE DROP ────────────────────────────────────────────────────────
// Re-use the existing scroll choreography: empty room becomes staged with
// a mask wipe from top-to-bottom + a soft glow on the leading edge.
function StagingDropSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Furniture drops in from top with a wipe
  const stagedClip = useTransform(
    scrollYProgress,
    [0.15, 0.55],
    ["inset(0 0 100% 0)", "inset(0 0 0% 0)"],
  );
  const seamY = useTransform(scrollYProgress, [0.15, 0.55], ["0%", "100%"]);
  const seamOpacity = useTransform(
    scrollYProgress,
    [0.13, 0.18, 0.52, 0.57],
    [0, 1, 1, 0],
  );
  const stagedShadowOpacity = useTransform(
    scrollYProgress,
    [0.15, 0.4, 0.6],
    [0, 0.5, 0],
  );

  return (
    <section className="relative bg-black py-32 md:py-44 overflow-hidden">
      {/* Background mesh */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, rgba(16,185,129,0.15), transparent 50%), radial-gradient(circle at 80% 70%, rgba(26,189,225,0.10), transparent 50%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-10 items-start">
          {/* Copy column */}
          <div className="lg:sticky lg:top-24">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5 }}
              className="text-[11px] font-mono uppercase tracking-[4px] text-emerald-400/80 mb-4"
            >
              02 / Furniture Drop
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-white text-3xl md:text-5xl font-bold leading-[1.05] tracking-tight"
            >
              Empty room.{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                Furnished by the time you scroll.
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-white/60 text-base mt-6 leading-relaxed"
            >
              Six furniture styles, architecture preserved exactly,
              shadows + ground contact rendered. Preview for free. Keep a
              render for $2.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-6 flex flex-wrap gap-2"
            >
              {["Modern", "Scandi", "Coastal", "Farmhouse", "Mid-century", "Luxe"].map(
                (s, i) => (
                  <span
                    key={s}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-white/[0.04] border border-white/10 text-white/80"
                  >
                    {s}
                  </span>
                ),
              )}
            </motion.div>
          </div>

          {/* Image stack */}
          <div
            ref={ref}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10"
          >
            <img
              src="/demos/hero-before.jpg"
              alt="Empty room"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <motion.img
              src="/demos/staged-after.jpg"
              alt="Staged room"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ clipPath: stagedClip }}
            />
            {/* Glowing horizontal seam — the "rendering boundary" */}
            <motion.div
              className="absolute left-0 right-0 h-[2px]"
              style={{
                top: seamY,
                opacity: seamOpacity,
                background:
                  "linear-gradient(90deg,transparent 0%,#34d399 30%,#34d399 70%,transparent 100%)",
                boxShadow: "0 0 24px 6px rgba(52,211,153,0.65)",
              }}
            />
            {/* Soft glow under the seam — like furniture is being conjured */}
            <motion.div
              className="absolute left-0 right-0 h-32 pointer-events-none"
              style={{
                top: seamY,
                opacity: stagedShadowOpacity,
                background:
                  "linear-gradient(180deg,rgba(52,211,153,0.25) 0%,transparent 100%)",
              }}
            />
            {/* Labels */}
            <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-white/80">
              Empty
            </div>
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-emerald-200 border border-emerald-500/40">
              Staged · $2
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── TWILIGHT ──────────────────────────────────────────────────────────────
// Day -> dusk transformation. Sky shifts color, lights start glowing.
function TwilightSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const dayHue = useTransform(scrollYProgress, [0.2, 0.6], [0, -25]);
  const dayBrightness = useTransform(scrollYProgress, [0.2, 0.6], [1, 0.55]);
  const dayContrast = useTransform(scrollYProgress, [0.2, 0.6], [1, 1.15]);
  const dayFilter = useTransform(
    [dayHue, dayBrightness, dayContrast],
    ([h, b, c]) =>
      `hue-rotate(${h}deg) brightness(${b}) contrast(${c}) saturate(1.3)`,
  );
  const orangeGlow = useTransform(scrollYProgress, [0.2, 0.6], [0, 0.55]);
  const purpleGlow = useTransform(scrollYProgress, [0.3, 0.7], [0, 0.4]);
  const sunY = useTransform(scrollYProgress, [0.2, 0.6], ["10%", "55%"]);

  return (
    <section className="relative bg-black py-32 md:py-44 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-mono uppercase tracking-[4px] text-cyan-300/80 mb-4"
        >
          03 / Virtual Twilight
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-white text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight max-w-4xl"
        >
          <span className="inline-flex items-center gap-3">
            <Sun className="w-10 h-10 md:w-14 md:h-14 text-amber-300" />
            Noon
          </span>
          <span className="text-white/40 mx-3 md:mx-5">→</span>
          <span className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            <Moon className="w-10 h-10 md:w-14 md:h-14 text-purple-300" />
            dusk
          </span>
          .<span className="block text-white/90 mt-2">One scroll.</span>
        </motion.h2>

        <div
          ref={ref}
          className="mt-16 relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 shadow-[0_30px_120px_-30px_rgba(255,108,84,0.35)]"
        >
          {/* Daylight base */}
          <motion.img
            src="/demos/hero-after.jpg"
            alt="Exterior daylight"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: dayFilter }}
          />
          {/* Orange/red horizon glow */}
          <motion.div
            className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
            style={{
              opacity: orangeGlow,
              background:
                "linear-gradient(to top, rgba(244,114,82,0.55) 0%, rgba(244,114,82,0.25) 40%, transparent 100%)",
              mixBlendMode: "screen",
            }}
          />
          {/* Purple/pink twilight tone on the top */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[60%] pointer-events-none"
            style={{
              opacity: purpleGlow,
              background:
                "linear-gradient(to bottom, rgba(127,55,189,0.6) 0%, rgba(127,55,189,0.2) 60%, transparent 100%)",
              mixBlendMode: "screen",
            }}
          />
          {/* Sun marker that descends */}
          <motion.div
            className="absolute left-[15%] w-12 h-12 md:w-20 md:h-20 rounded-full"
            style={{
              top: sunY,
              background:
                "radial-gradient(circle, rgba(255,200,80,0.9) 0%, rgba(255,150,80,0.4) 40%, transparent 70%)",
              filter: "blur(2px)",
            }}
          />

          <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-white/80">
            Original
          </div>
          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-purple-500/20 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-purple-200 border border-purple-500/40">
            Twilight · $1
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mt-8 text-white/60 text-base md:text-lg max-w-3xl"
        >
          Any exterior shot, transformed into a dusk scene. Architecture
          preserved. MLS-ethical. Preview free, keep it for a dollar.
        </motion.p>
      </div>
    </section>
  );
}

// ─── PROCESS ───────────────────────────────────────────────────────────────
// Three pinned steps. Each animates in as you scroll, with an icon, label,
// and a one-liner. The connecting line glows green as steps light up.
function ProcessSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 60%"],
  });
  const fillWidth = useTransform(scrollYProgress, [0, 0.9], ["0%", "100%"]);

  const steps = [
    {
      label: "Scan",
      icon: Eye,
      copy: "14 checks per photo. Verticals, color, exposure, sharpness, distractions, privacy.",
      threshold: 0.15,
    },
    {
      label: "Decide",
      icon: Wand2,
      copy: "Claude Sonnet vision picks what to fix, what to flag, and what to leave alone.",
      threshold: 0.45,
    },
    {
      label: "Render",
      icon: Sparkles,
      copy: "Fixes applied. Optional staging or twilight. Delivered.",
      threshold: 0.75,
    },
  ];

  return (
    <section ref={ref} className="relative bg-black py-32 md:py-44 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-mono uppercase tracking-[4px] text-emerald-400/80 mb-4 text-center"
        >
          04 / How it works
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-white text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-center mb-20"
        >
          Three phases.{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">
            One scroll.
          </span>
        </motion.h2>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-[60px] left-[10%] right-[10%] h-[2px] bg-white/5" />
          <motion.div
            className="hidden md:block absolute top-[60px] left-[10%] h-[2px]"
            style={{
              width: fillWidth,
              maxWidth: "80%",
              background: "linear-gradient(90deg, #34d399, #67e8f9)",
              boxShadow: "0 0 16px rgba(52,211,153,0.6)",
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.7, delay: i * 0.12 }}
                  className="text-center"
                >
                  <div className="relative inline-flex w-[120px] h-[120px] items-center justify-center mb-6">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 backdrop-blur border border-emerald-500/30" />
                    <div className="absolute inset-2 rounded-full bg-black border border-white/10" />
                    <Icon className="relative w-10 h-10 text-emerald-300" strokeWidth={1.5} />
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 text-black text-xs font-bold flex items-center justify-center font-mono">
                      0{i + 1}
                    </div>
                  </div>
                  <h3 className="text-white text-2xl font-semibold mb-2">{s.label}</h3>
                  <p className="text-white/55 text-sm leading-relaxed max-w-[260px] mx-auto">
                    {s.copy}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PRICING / CTA ─────────────────────────────────────────────────────────
function PricingCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  const tiers = [
    {
      id: "qc",
      label: "Photo QC + edits",
      price: "$5",
      sub: "per property",
      badge: "Staffify partners",
      icon: CheckCircle2,
      accent: "from-emerald-500/20 to-emerald-500/0",
      border: "border-emerald-500/30",
    },
    {
      id: "staging",
      label: "Virtual staging",
      price: "$2",
      sub: "per kept render",
      badge: "Preview free",
      icon: Layers,
      accent: "from-cyan-500/20 to-cyan-500/0",
      border: "border-cyan-500/30",
    },
    {
      id: "twilight",
      label: "Virtual twilight",
      price: "$1",
      sub: "per kept render",
      badge: "Preview free",
      icon: Moon,
      accent: "from-purple-500/20 to-purple-500/0",
      border: "border-purple-500/30",
    },
  ];

  return (
    <section ref={ref} className="relative bg-black py-32 md:py-44 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-[11px] font-mono uppercase tracking-[4px] text-emerald-400/80 mb-4"
          >
            05 / Pricing
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-white text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight"
          >
            Render math.{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              Simple.
            </span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                className={`relative rounded-2xl border ${t.border} bg-white/[0.02] backdrop-blur p-6 overflow-hidden group cursor-pointer transition-transform duration-300 ${hover === t.id ? "scale-[1.02]" : ""}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${t.accent} opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <Icon className="w-6 h-6 text-white/80" strokeWidth={1.5} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/50 px-2 py-0.5 rounded-full border border-white/15">
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-1">{t.label}</p>
                  <p className="text-white font-extrabold text-5xl tracking-tight leading-none mb-1">
                    {t.price}
                  </p>
                  <p className="text-white/45 text-xs font-mono">{t.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 text-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-black font-bold text-base hover:from-emerald-400 hover:to-emerald-300 transition shadow-[0_0_40px_rgba(16,185,129,0.45)]"
          >
            Render your first property free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-white/40 text-xs font-mono mt-4">
            5 welcome credits · No card required · Staffify partners auto-detected
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────
export default function RenderingsPage() {
  return (
    <main className="bg-black text-white relative overflow-x-hidden">
      {/* Floating top brand */}
      <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight">AutoQC</span>
          </Link>
          <Link
            href="/signup"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 transition"
          >
            Try free
          </Link>
        </div>
      </div>

      <CinemaHero />
      <ColorStorySection />
      <StagingDropSection />
      <TwilightSection />
      <ProcessSection />
      <PricingCTA />

      {/* Footer */}
      <footer className="bg-black border-t border-white/5 py-12 text-center">
        <p className="text-white/40 text-xs font-mono">
          AutoQC × Staffify · Renderings, by the second
        </p>
        <div className="mt-4 flex items-center justify-center gap-6 text-white/60 text-sm">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/demo" className="hover:text-white transition">Demo</Link>
          <Link href="/faq" className="hover:text-white transition">FAQ</Link>
        </div>
      </footer>
    </main>
  );
}
