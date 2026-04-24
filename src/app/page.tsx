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
  Moon,
  ArrowDownUp,
  RotateCcw,
  Sofa,
  FolderSync,
} from "lucide-react";
import { SpotlightCard } from "@/components/landing/SpotlightCard";
import { TwilightHero } from "@/components/landing/TwilightHero";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const features: Array<{
  icon: any;
  title: string;
  copy: string;
  premium?: boolean;
  isNew?: boolean;
}> = [
  {
    icon: FolderSync,
    title: "AutoHDR → AutoQC pipeline",
    copy: "Pipe your AutoHDR finals straight into AutoQC via Dropbox. Every drop is QC'd automatically and reviewed JPEGs replace the originals in place. Zero new folders, zero new clicks.",
    isNew: true,
  },
  {
    icon: Sofa,
    title: "Virtual Staging",
    copy: "Empty rooms filled with realistic furniture in six styles. Architecture preserved exactly. Preview free, keep a render for $3. Currently in closed beta.",
    isNew: true,
  },
  {
    icon: Moon,
    title: "Virtual Twilight",
    copy: "Any exterior photo transformed into a dusk scene. Preview free, keep it for $1. MLS-ethical, architecture preserved.",
    isNew: true,
  },
  {
    icon: ArrowDownUp,
    title: "Auto-sort by room type",
    copy: "Photos grouped into your agency's MLS order automatically. Galleries flow cleanly, no dragging needed.",
    isNew: true,
  },
  {
    icon: RotateCcw,
    title: "One-click revert",
    copy: "Disagree with an auto-fix? Revert to the untouched original in one click. AI proposes, you approve.",
    isNew: true,
  },
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
            <a href="#why" className="hover:text-foreground transition">
              Why it matters
            </a>
            <a href="#never" className="hover:text-foreground transition">
              Trust
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
              href="/signup"
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
              The last stop between your editor and your agent
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]"
            >
              Catch what your editors miss.
              <br />
              <span className="text-primary">Before your agent does.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              AutoQC is <span className="text-foreground font-medium">not an editing service</span>.
              Your editor (overseas team, in-house, Imagen, AutoHDR, whoever)
              still edits. AutoQC is the pass that runs after, catching the
              crooked wall, the blown window, the unblurred family photo. Plugs
              in between your editor and the realtor, ships the final set to
              Aryeo, HDPhotoHub, or Dropbox when you are done.
            </motion.p>

            {/* Workflow strip */}
            <motion.div
              variants={fadeUp}
              className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground pt-1"
            >
              <span className="px-2.5 py-1 rounded-md border border-border bg-[hsl(var(--surface-1))]">
                Shoot
              </span>
              <span className="text-border">→</span>
              <span className="px-2.5 py-1 rounded-md border border-border bg-[hsl(var(--surface-1))]">
                Your editor
              </span>
              <span className="text-border">→</span>
              <span className="px-2.5 py-1 rounded-md border border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">
                AutoQC
              </span>
              <span className="text-border">→</span>
              <span className="px-2.5 py-1 rounded-md border border-border bg-[hsl(var(--surface-1))]">
                Agent / MLS
              </span>
            </motion.div>

            {/* Stats bar */}
            <motion.div
              variants={fadeUp}
              className="flex items-center justify-center gap-x-5 gap-y-2 flex-wrap text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground pt-3"
            >
              <span className="flex items-center gap-1.5">
                <span className="stat-num text-foreground">14</span>
                <span>QC checks</span>
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <span className="stat-num text-foreground">45</span>
                <span>photos in under 2 min</span>
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <span>From</span>
                <span className="stat-num text-foreground">$8</span>
                <span>/ property</span>
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <span className="stat-num text-foreground">0</span>
                <span>subscriptions</span>
              </span>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
            >
              <Link
                href="/signup"
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
                Tilt and warm cast, corrected
              </span>
              <span className="flex items-center gap-1.5 text-primary">
                <span className="w-1.5 h-1.5 rounded-full accent-bg animate-pulse" />
                LIVE RESULT
              </span>
            </div>
            <ReactCompareSlider
              itemOne={
                <ReactCompareSliderImage
                  src="/demos/hero-before.jpg"
                  alt="Living room with a yellow color cast and slight tilt, raw camera output"
                />
              }
              itemTwo={
                <ReactCompareSliderImage
                  src="/demos/hero-after.jpg"
                  alt="Same living room after AutoQC, with verticals straightened and color neutralized"
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
              <span className="stat-num">14</span> checks.{" "}
              <span className="stat-num">9</span> auto-fixes.{" "}
              <span className="stat-num">3</span> AI rescues.
              <br />
              On every property. Before your agent sees it.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3"
            >
              Quality checks run on every photo before it reaches your
              agent. Auto-fixes apply when safe, get flagged when your
              eyes are needed. Premium features are tagged. Nothing is
              cosmetic. Nothing is a guess.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
            style={{ perspective: "1200px" }}
          >
            {features.map((f) => (
              <SpotlightCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                copy={f.copy}
                premium={f.premium}
                isNew={f.isNew}
                variants={fadeUp}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Virtual Twilight — prominent new-feature spotlight */}
      <TwilightHero />

      {/* Kitchen color-temperature demo */}
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
              Color temperature
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              Tungsten cast, neutralized.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3 max-w-2xl"
            >
              Mixed interior lighting gives every kitchen a yellow cast.
              AutoQC reads the scene, pulls the white balance back to
              neutral, and delivers the clean white cabinets the agent
              expects to see.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="panel overflow-hidden"
          >
            <div className="p-3 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Kitchen interior, yellow cast corrected
            </div>
            <ReactCompareSlider
              itemOne={
                <ReactCompareSliderImage
                  src="/demos/kitchen-before.jpg"
                  alt="Kitchen interior with yellow tungsten color cast"
                />
              }
              itemTwo={
                <ReactCompareSliderImage
                  src="/demos/kitchen-after.jpg"
                  alt="Same kitchen with white balance neutralized"
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

      {/* Why this matters (trust angle) */}
      <section id="why" className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
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
              Why this matters
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-semibold tracking-tight"
            >
              One missed error, one lost agent.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3 max-w-2xl"
            >
              Real estate photographers do not lose clients over average work.
              They lose clients over the single listing where a crooked wall,
              a blown window, or a visible family portrait slipped past the
              editor. That one mistake is what the agent remembers.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-3"
          >
            <motion.div variants={fadeUp} className="panel p-5">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Before AutoQC
              </p>
              <p className="text-sm leading-relaxed">
                You deliver what the editor sent back. Sometimes that is fine.
                Sometimes the agent finds the problem before you do.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} className="panel p-5">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                With AutoQC
              </p>
              <p className="text-sm leading-relaxed">
                Every shot runs through an automated fourteen-point audit
                before delivery. Mistakes get caught and fixed or flagged
                for your eyes only.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} className="panel p-5 border-[hsl(var(--primary))]/40">
              <p className="text-[11px] font-mono uppercase tracking-wider text-primary mb-2">
                Result
              </p>
              <p className="text-sm leading-relaxed">
                Fewer revision requests. Fewer awkward Slack messages with
                your agent. Fewer contracts lost to a single missed photo.
              </p>
            </motion.div>
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
              Trust works both ways.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3 max-w-xl mx-auto"
            >
              If you are going to trust AutoQC as your final checkpoint, you
              need to know what it refuses to do. These rules do not bend.
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
              Four steps. Under two minutes. No manual labor.
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
                timing: "~30 seconds",
                copy: "Drag a shoot in. JPEG, PNG, TIFF. Direct to S3, no round-trip through a server.",
              },
              {
                icon: Eye,
                step: "02",
                title: "Scan",
                timing: "~90 seconds",
                copy: "14 QC checks run in parallel Lambdas on every shot. Claude Vision grades composition. Faster than your coffee cools.",
              },
              {
                icon: Zap,
                step: "03",
                title: "Fix",
                timing: "Zero manual labor",
                copy: "Auto-fixes apply when safe. AI rescues deblur soft focus. Distractions inpainted out. Recommendations executed, not suggested.",
              },
              {
                icon: Send,
                step: "04",
                title: "Deliver",
                timing: "One click",
                copy: "Push to Aryeo, HDPhotoHub, Spiro, or Tonomo. Or download the ZIP. Lightroom-compatible bundle available.",
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
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.1em] border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-primary">
                  {s.timing}
                </span>
                <p className="text-[13px] text-muted-foreground mt-2.5 leading-relaxed">
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
            Deliver with confidence. Every time.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-3"
          >
            Add AutoQC as the last step before your photos reach the agent.
            Protect the relationships you spent years building.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-7"
          >
            <Link
              href="/signup"
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
            <Link href="/privacy" className="hover:text-foreground transition">
              Privacy
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
