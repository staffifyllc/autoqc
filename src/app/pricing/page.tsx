"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Coins,
  CreditCard,
  Sparkles,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const creditPackages = [
  { name: "Starter", credits: 10, price: 100, perCredit: 10, savings: 0 },
  { name: "Professional", credits: 25, price: 225, perCredit: 9, savings: 10 },
  { name: "Agency", credits: 50, price: 425, perCredit: 8.5, savings: 15, popular: true },
  { name: "Scale", credits: 100, price: 800, perCredit: 8, savings: 20 },
];

export default function PricingPage() {
  const [propertiesPerMonth, setPropertiesPerMonth] = useState(50);
  const [mode, setMode] = useState<"credits" | "payg">("credits");

  const perProperty = mode === "credits" ? 9 : 12; // Avg with bulk discount
  const monthly = propertiesPerMonth * perProperty;
  const hoursPerProperty = 0.5;
  const hourlyRate = 35;
  const timeSaved = propertiesPerMonth * hoursPerProperty;
  const moneySaved = timeSaved * hourlyRate - monthly;

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">AutoQC</span>
          </Link>
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <div className="pt-28 pb-16 px-6 max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h1 className="text-4xl font-bold">
              Buy credits. Save more. Process photos.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Buy credits in bulk for the best rate. Or pay as you go for
              flexibility. You choose.
            </p>
          </motion.div>

          {/* Two pricing modes */}
          <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-6 mb-16">
            {/* Credits mode */}
            <div className="glass-card p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-lg gradient-bg text-white text-xs font-bold">
                RECOMMENDED
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Credits</h3>
                  <p className="text-sm text-muted-foreground">
                    Prepaid, never expire
                  </p>
                </div>
              </div>

              <div>
                <p className="text-4xl font-bold">
                  $8
                  <span className="text-lg font-normal text-muted-foreground">
                    -$10 / property
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Rate depends on package size
                </p>
              </div>

              <ul className="space-y-2.5 text-sm">
                {[
                  "1 credit = 1 property processed",
                  "Volume discounts up to 20%",
                  "Credits never expire",
                  "No monthly commitment",
                  "Save up to $400/month at scale",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className="block text-center py-3 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition"
              >
                Start with Credits
              </Link>
            </div>

            {/* PAYG mode */}
            <div className="glass-card p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Pay As You Go</h3>
                  <p className="text-sm text-muted-foreground">
                    Charged per property
                  </p>
                </div>
              </div>

              <div>
                <p className="text-4xl font-bold">
                  $12
                  <span className="text-lg font-normal text-muted-foreground">
                    {" "}
                    / property
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Flat rate, no commitments
                </p>
              </div>

              <ul className="space-y-2.5 text-sm">
                {[
                  "Just add a card",
                  "Charged automatically per property",
                  "No upfront purchase",
                  "No monthly commitment",
                  "Higher rate than credits",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className="block text-center py-3 rounded-xl glass hover:bg-white/10 font-medium transition"
              >
                Use Pay As You Go
              </Link>
            </div>
          </motion.div>

          {/* Credit packages */}
          <motion.div variants={fadeUp} className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">
              Credit Packages
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Buy more, save more. Credits never expire.
            </p>

            <div className="grid md:grid-cols-4 gap-4">
              {creditPackages.map((pkg) => (
                <div
                  key={pkg.name}
                  className={`glass-card p-6 space-y-4 relative ${
                    pkg.popular ? "ring-2 ring-brand-500 glow" : ""
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-bg text-white text-xs font-bold">
                      MOST POPULAR
                    </div>
                  )}
                  {pkg.savings > 0 && (
                    <span className="inline-block px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-xs font-bold">
                      Save {pkg.savings}%
                    </span>
                  )}
                  <div>
                    <h3 className="font-semibold">{pkg.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold">{pkg.credits}</span>
                      <span className="text-xs text-muted-foreground">
                        credits
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">${pkg.price}</p>
                    <p className="text-xs text-muted-foreground">
                      ${pkg.perCredit.toFixed(2)} per credit
                    </p>
                  </div>
                  <Link
                    href="/login"
                    className="block text-center py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition"
                  >
                    Get Started
                  </Link>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ROI Calculator */}
          <motion.div variants={fadeUp} className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calculator className="w-6 h-6 text-brand-400" />
              <h2 className="text-xl font-bold">ROI Calculator</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Properties per month
                </label>
                <input
                  type="range"
                  min={5}
                  max={500}
                  step={5}
                  value={propertiesPerMonth}
                  onChange={(e) =>
                    setPropertiesPerMonth(parseInt(e.target.value))
                  }
                  className="w-full accent-brand-500 mb-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5</span>
                  <span className="text-foreground font-bold text-base">
                    {propertiesPerMonth}
                  </span>
                  <span>500</span>
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <button
                    onClick={() => setMode("credits")}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                      mode === "credits"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "glass hover:bg-white/10"
                    }`}
                  >
                    With Credits
                  </button>
                  <button
                    onClick={() => setMode("payg")}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                      mode === "payg"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "glass hover:bg-white/10"
                    }`}
                  >
                    Pay As You Go
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-muted-foreground">
                    Monthly AutoQC cost
                  </span>
                  <span className="font-bold">
                    ${monthly.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-muted-foreground">
                    Time saved ({timeSaved.toFixed(0)} hrs/mo)
                  </span>
                  <span className="font-bold text-green-400">
                    ${(timeSaved * hourlyRate).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="text-sm font-medium text-green-400">
                    Net savings per month
                  </span>
                  <span className="font-bold text-green-400">
                    ${Math.max(0, moneySaved).toLocaleString()}
                  </span>
                </div>
                {mode === "payg" && monthly > 0 && (
                  <div className="flex justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-sm text-amber-400">
                      Extra you'd pay vs credits
                    </span>
                    <span className="font-bold text-amber-400">
                      +${(propertiesPerMonth * 3).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Based on 30 min average QC time per property at $35/hr editor rate.
              Actual savings depend on your current workflow.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
