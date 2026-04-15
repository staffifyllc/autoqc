"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import {
  ArrowRight,
  Ban,
  Camera,
  CheckCircle2,
  Ruler,
  Palette,
  Sparkles,
  Shield,
  Trash2,
  Sun,
  Aperture,
  Wand2,
  Eye,
  Upload,
  Send,
  Zap,
  Building2,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const features = [
  {
    icon: Ruler,
    title: "Vertical straightening",
    copy: "Every crooked wall, door frame, and window frame auto-corrected.",
  },
  {
    icon: Ruler,
    title: "Horizon leveling",
    copy: "Detects tilted shots and rotates them to true level automatically.",
  },
  {
    icon: Palette,
    title: "White balance correction",
    copy: "Tungsten, fluorescent, mixed-light casts neutralized cleanly.",
  },
  {
    icon: Sun,
    title: "Color temperature tuning",
    copy: "Warms or cools each shot to match a consistent listing look.",
  },
  {
    icon: Sparkles,
    title: "Exposure, highlights, shadows",
    copy: "Ceiling blowout pulled back, dark corners lifted, all within safe ranges.",
  },
  {
    icon: Aperture,
    title: "HSL saturation by color",
    copy: "Over-greened grass, sunset-orange ceilings, blown-out blues. Fixed per channel.",
  },
  {
    icon: Wand2,
    title: "AI deblur for soft focus",
    copy: "NAFNet rescue pass on slightly-soft images when it would otherwise fail QC.",
  },
  {
    icon: Eye,
    title: "Composition and sharpness audit",
    copy: "Claude Vision grades nine categories and flags anything a human reviewer would.",
  },
  {
    icon: Shield,
    title: "Privacy blur",
    copy: "Framed family photos, kids, diplomas with names. Subtly blurred. Premium tier.",
    premium: true,
  },
  {
    icon: Trash2,
    title: "Distraction removal",
    copy: "Trash bins, hoses, kid toys, cables, photographer reflections. Inpainted out. Premium.",
    premium: true,
  },
  {
    icon: CheckCircle2,
    title: "MLS ethics check",
    copy: "Flags anything that could misrepresent the property before you deliver.",
  },
  {
    icon: Building2,
    title: "Style profile matching",
    copy: "Learns your agency look from reference photos and matches every output to it.",
  },
];

const neverDos = [
  "Crop your photos. Composition is yours.",
  "Change aspect ratio or reframe the shot.",
  "Fabricate features that do not exist in the house.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md accent-bg flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight">AutoQC</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-[13px] text-muted-foreground font-mono">
            <a href="#what-it-does" className="hover:text-foreground transition">
              What it does
            </a>
            <a href="#never" className="hover:text-foreground transition">
              What we never do
            </a>
            <a href="#how" className="hover:text-foreground transition">
              How it works
            </a>
            <Link href="/pricing" className="hover:text-foreground transition">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition px-3"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm px-3.5 py-1.5 rounded-md accent-bg text-black font-medium hover:opacity-90 transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-center space-y-6"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
            >
              <span className="w-1.5 h-1.5 rounded-full accent-bg" />
              Built for real estate photo teams
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]"
            >
              A full shoot, edited in minutes.
              <br />
              <span className="text-primary">Not overnight.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              Upload raw. AutoQC scores every shot across nine categories,
              fixes the mechanical stuff, blurs the private stuff, and cleans
              up the distractions. A 30 to 60 photo property finishes in
              under ten minutes. No Lightroom. No editor queue. Same day
              delivery, every time.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
            >
              <Link
                href="/login"
                className="group flex items-center gap-2 px-5 py-2.5 rounded-md accent-bg text-black text-sm font-medium hover:opacity-90 transition"
              >
                Get started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#demo"
                className="flex items-center gap-2 px-5 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-[hsl(var(--surface-2))] transition"
              >
                See it work
              </a>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground pt-1"
            >
              From <span className="stat-num">$8</span>/property. No subscription.
            </motion.p>
          </motion.div>

          {/* Hero slider */}
          <motion.div
            id="demo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-14 panel overflow-hidden"
          >
            <div className="p-3 border-b border-border flex items-center justify-between text-[11px] font-mono uppercase tracking-wider">
              <span className="text-muted-foreground">
                Privacy blur on framed photos
              </span>
              <span className="flex items-center gap-1.5 text-primary">
                <span className="w-1.5 h-1.5 rounded-full accent-bg animate-pulse" />
                LIVE RESULT
              </span>
            </div>
            <ReactCompareSlider
              itemOne={
                <ReactCompareSliderImage
                  src="/demos/privacy-before.jpg"
                  alt="Original interior with visible framed photos"
                />
              }
              itemTwo={
                <ReactCompareSliderImage
                  src="/demos/privacy-after.jpg"
                  alt="Same interior after AutoQC privacy blur"
                />
              }
              className="max-h-[70vh]"
            />
            <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>← Raw upload</span>
              <span>Drag to compare</span>
              <span className="text-primary">AutoQC output →</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What it does */}
      <section id="what-it-does" className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-2xl mb-12"
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3"
            >
              What it does
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              Twelve corrections. One upload.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3"
            >
              The checks and fixes below run on every property. Premium-only
              features are flagged. Nothing is a suggestion. Every recommended
              adjustment is executed automatically, within safe magnitude caps,
              before you see the photo.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="panel p-5 space-y-3 hover:border-[hsl(var(--accent))]/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center">
                    <f.icon className="w-4 h-4 text-primary" strokeWidth={2} />
                  </div>
                  {f.premium && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-yellow-300/80 border border-yellow-300/30 rounded-full px-2 py-0.5">
                      ★ Premium
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-sm">{f.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                    {f.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Verticals demo */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mb-8"
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3"
            >
              Mechanical corrections
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              Tilt, cast, and exposure, resolved.
            </motion.h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="panel overflow-hidden"
          >
            <div className="p-3 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Straightened verticals on a tilted interior
            </div>
            <ReactCompareSlider
              itemOne={
                <ReactCompareSliderImage
                  src="/demos/verticals-before.jpg"
                  alt="Original tilted interior"
                />
              }
              itemTwo={
                <ReactCompareSliderImage
                  src="/demos/verticals-after.jpg"
                  alt="Interior with verticals straightened"
                />
              }
              className="max-h-[70vh]"
            />
            <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>← Raw upload</span>
              <span>Drag to compare</span>
              <span className="text-primary">AutoQC output →</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What we never do */}
      <section id="never" className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-10"
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3"
            >
              What we never do
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              The property is the property.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3 max-w-xl mx-auto"
            >
              Hard product rules. No exceptions. If we could not do it honestly
              in the darkroom, we do not do it here.
            </motion.p>
          </motion.div>

          <motion.ul
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="space-y-2 max-w-2xl mx-auto"
          >
            {neverDos.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-start gap-3 panel p-4"
              >
                <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2.5} />
                <span className="text-sm">{item}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mb-12"
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3"
            >
              How it works
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              Four steps. No manual labor.
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-4 gap-3"
          >
            {[
              {
                icon: Upload,
                step: "01",
                title: "Upload",
                copy: "Drag a shoot in. JPEG, PNG, TIFF.",
              },
              {
                icon: Eye,
                step: "02",
                title: "Scan",
                copy: "Nine-category QC audit runs on every shot in parallel.",
              },
              {
                icon: Zap,
                step: "03",
                title: "Fix",
                copy: "Corrections applied automatically. Recommendations executed, not suggested.",
              },
              {
                icon: Send,
                step: "04",
                title: "Deliver",
                copy: "Push to Aryeo, HDPhotoHub, Spiro, or Tonomo. Or download the ZIP.",
              },
            ].map((s) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                className="panel p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] text-muted-foreground stat-num">
                    {s.step}
                  </span>
                  <s.icon className="w-4 h-4 text-primary" strokeWidth={2} />
                </div>
                <h3 className="font-medium text-sm">{s.title}</h3>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                  {s.copy}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing tease */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="mb-10"
          >
            <motion.p
              variants={fadeUp}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3"
            >
              Pricing
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              Per property. No subscription.
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-2 gap-3"
          >
            <motion.div variants={fadeUp} className="panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Standard</h3>
                <span className="font-mono text-sm stat-num">
                  $8 to $10<span className="text-muted-foreground">/property</span>
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Color correction, color temperature, vertical straightening,
                horizon leveling, exposure, sharpness, composition audit, MLS
                ethics check, style profile matching.
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="panel p-6 border-yellow-300/30"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-yellow-300">★</span> Premium
                </h3>
                <span className="font-mono text-sm stat-num">
                  $16 to $20<span className="text-muted-foreground">/property</span>
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Everything in Standard, plus privacy blur on personal photos
                and AI distraction removal for trash bins, hoses, toys, cables,
                and photographer reflections.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-6 text-center"
          >
            <Link
              href="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition"
            >
              See full pricing →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-semibold tracking-tight"
          >
            Deliver same-day. Every time.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-3"
          >
            Create an account in a minute. Upload your first property. See what
            every listing could look like.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-7"
          >
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-md accent-bg text-black font-medium hover:opacity-90 transition"
            >
              Get started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded accent-bg flex items-center justify-center">
              <Camera className="w-3 h-3 text-black" strokeWidth={2.5} />
            </div>
            <span>AUTOQC</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-foreground transition">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-foreground transition">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
