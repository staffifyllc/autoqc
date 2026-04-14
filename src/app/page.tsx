"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Zap,
  Shield,
  BarChart3,
  ArrowRight,
  Upload,
  Sparkles,
  Eye,
  Send,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">AutoQC</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-foreground transition">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition glow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 dot-pattern opacity-30" />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="space-y-6"
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-muted-foreground"
            >
              <Sparkles className="w-4 h-4 text-brand-400" />
              AI-Powered Quality Control for Real Estate Photography
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-5xl md:text-7xl font-bold tracking-tight"
            >
              Stop reviewing photos
              <br />
              <span className="gradient-text">manually.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              AutoQC automatically detects crooked verticals, bad color,
              exposure issues, and more. Fix them instantly. Push to your
              delivery platform. Done.
            </motion.p>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            >
              <Link
                href="/login"
                className="group flex items-center gap-2 px-8 py-3.5 rounded-xl gradient-bg text-white font-semibold text-lg hover:opacity-90 transition glow"
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/demo"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl glass-card text-foreground font-medium hover:bg-white/10 transition"
              >
                <Eye className="w-5 h-5" />
                Try the Demo
              </Link>
            </motion.div>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-sm text-muted-foreground"
            >
              Buy credits from $8/property. No subscriptions.
            </motion.p>
          </motion.div>

          {/* Hero image placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 glass-card p-2 mx-auto max-w-4xl"
          >
            <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-brand-950 to-gray-900 flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 dot-pattern opacity-20" />
              <div className="relative text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  24 of 25 photos passed QC. 1 auto-fixed.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-bold"
            >
              Four steps. Zero headaches.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3 max-w-lg mx-auto"
            >
              Upload your shoot, let AI handle the rest.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-4 gap-6"
          >
            {[
              {
                icon: Upload,
                title: "Upload",
                desc: "Drag and drop your property photos. We accept RAW, JPEG, TIFF, PNG.",
                color: "text-blue-400",
                bg: "bg-blue-500/10 border-blue-500/20",
              },
              {
                icon: Eye,
                title: "QC Scan",
                desc: "AI checks verticals, color, exposure, sharpness, and composition in seconds.",
                color: "text-purple-400",
                bg: "bg-purple-500/10 border-purple-500/20",
              },
              {
                icon: Sparkles,
                title: "Auto-Fix",
                desc: "Crooked verticals get straightened. Bad white balance gets corrected. Automatically.",
                color: "text-amber-400",
                bg: "bg-amber-500/10 border-amber-500/20",
              },
              {
                icon: Send,
                title: "Deliver",
                desc: "Push approved photos straight to Aryeo, HDPhotoHub, Spiro, or Tonomo.",
                color: "text-green-400",
                bg: "bg-green-500/10 border-green-500/20",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="glass-card-hover p-6 text-center space-y-4"
              >
                <div className="flex items-center justify-center">
                  <div
                    className={`w-14 h-14 rounded-2xl ${step.bg} border flex items-center justify-center`}
                  >
                    <step.icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                </div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Step {i + 1}
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 relative">
        <div className="absolute inset-0 mesh-gradient opacity-50" />
        <div className="relative max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-bold"
            >
              Built for real estate photo teams
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              {
                icon: Shield,
                title: "Style Profiles",
                desc: "Upload reference photos. We learn your look. Every shoot is checked against YOUR standard, not a generic one.",
              },
              {
                icon: BarChart3,
                title: "Client Preferences",
                desc: "Realtor A wants warm and bright. Realtor B wants moody. Set per-client profiles that override your defaults.",
              },
              {
                icon: Zap,
                title: "Auto-Corrections",
                desc: "Verticals straightened. White balance fixed. Exposure normalized. All automatic, all reversible.",
              },
              {
                icon: Eye,
                title: "AI Composition Check",
                desc: "Spots visible toilets, photographer reflections, clutter, and cropped fixtures. Things humans miss on photo #47.",
              },
              {
                icon: CheckCircle2,
                title: "Set Consistency",
                desc: "Detects when one room's color temperature drifts from the rest. Keeps the whole set cohesive.",
              },
              {
                icon: Send,
                title: "Platform Push",
                desc: "Connect Aryeo, HDPhotoHub, Spiro, or Tonomo. Approved photos push straight to your delivery platform.",
              },
            ].map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="glass-card-hover p-6 space-y-3"
              >
                <feature.icon className="w-6 h-6 text-brand-400" />
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-4xl font-bold"
            >
              Buy credits. Save more. Use them anytime.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-muted-foreground mt-3"
            >
              1 credit = 1 property. Credits never expire. Or use pay-as-you-go at $12/property.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-4 gap-4"
          >
            {[
              {
                tier: "Starter",
                credits: 10,
                price: 100,
                perCredit: 10,
                savings: 0,
              },
              {
                tier: "Professional",
                credits: 25,
                price: 225,
                perCredit: 9,
                savings: 10,
              },
              {
                tier: "Agency",
                credits: 50,
                price: 425,
                perCredit: 8.5,
                savings: 15,
                popular: true,
              },
              {
                tier: "Scale",
                credits: 100,
                price: 800,
                perCredit: 8,
                savings: 20,
              },
            ].map((plan) => (
              <motion.div
                key={plan.tier}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className={`glass-card-hover p-6 space-y-4 relative ${
                  plan.popular ? "ring-2 ring-brand-500 glow" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-bg text-white text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{plan.tier}</h3>
                  {plan.savings > 0 && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-xs font-bold">
                      Save {plan.savings}%
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.credits}</span>
                    <span className="text-xs text-muted-foreground">
                      credits
                    </span>
                  </div>
                  <p className="text-2xl font-bold mt-2">${plan.price}</p>
                  <p className="text-xs text-muted-foreground">
                    ${plan.perCredit.toFixed(2)} per credit
                  </p>
                </div>
                <Link
                  href="/login"
                  className={`block text-center py-2.5 rounded-xl font-medium text-sm transition ${
                    plan.popular
                      ? "gradient-bg text-white hover:opacity-90"
                      : "glass hover:bg-white/10"
                  }`}
                >
                  Get Started
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Or pay-as-you-go at $12/property with a card on file. No subscriptions, no commitments.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center glass-card p-12 relative overflow-hidden"
        >
          <div className="absolute inset-0 mesh-gradient" />
          <div className="relative space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to automate your QC?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Join real estate photography agencies that are saving hours per
              week on quality control.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl gradient-bg text-white font-semibold text-lg hover:opacity-90 transition glow"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-bg flex items-center justify-center">
              <Camera className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">AutoQC</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for real estate photography teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
