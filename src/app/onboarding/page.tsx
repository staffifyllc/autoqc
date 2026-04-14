"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ArrowRight, Building2, Palette, Plug, Coins } from "lucide-react";

const steps = [
  { id: "agency", label: "Agency", icon: Building2 },
  { id: "style", label: "Style", icon: Palette },
  { id: "credits", label: "Credits", icon: Coins },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [agencyName, setAgencyName] = useState("");
  const [profileName, setProfileName] = useState("");

  const handleCreateAgency = async () => {
    // Will call API to create agency
    setStep(1);
  };

  const handleCreateProfile = async () => {
    // Will call API to create profile
    setStep(2);
  };

  const handleFinish = () => {
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">AutoQC</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  i === step
                    ? "bg-brand-500/20 text-brand-400"
                    : i < step
                    ? "text-green-400"
                    : "text-muted-foreground"
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-px mx-2 ${
                    i < step ? "bg-green-500/50" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="glass-card p-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="agency"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold">Set up your agency</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is your company name. Your team and clients will see
                    this.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Agency / Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WeShoot Photography"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleCreateAgency}
                  disabled={!agencyName.trim()}
                  className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="style"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold">
                    Create your first style profile
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Name your default editing style. You can upload reference
                    photos later from the dashboard.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Style Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bright & Airy, Natural, Magazine"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 rounded-xl glass hover:bg-white/10 text-sm font-medium transition"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handleCreateProfile}
                    disabled={!profileName.trim()}
                    className="flex-1 py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="credits"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold">
                    Buy credits to get started
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Payment is required before processing any properties.
                    Credits save you money versus pay-as-you-go.
                  </p>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      name: "Starter",
                      credits: 10,
                      price: "$100",
                      desc: "10 properties at $10 each",
                    },
                    {
                      name: "Professional",
                      credits: 25,
                      price: "$225",
                      desc: "25 properties at $9 each",
                      savings: "Save 10%",
                    },
                    {
                      name: "Agency",
                      credits: 50,
                      price: "$425",
                      desc: "50 properties at $8.50 each",
                      savings: "Save 15%",
                      popular: true,
                    },
                  ].map((pkg) => (
                    <button
                      key={pkg.name}
                      onClick={() => {
                        window.location.href = "/dashboard/credits";
                      }}
                      className={`w-full p-4 rounded-xl text-left transition flex items-center justify-between ${
                        pkg.popular
                          ? "bg-brand-500/10 border border-brand-500/30 hover:bg-brand-500/20"
                          : "glass hover:bg-white/10"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {pkg.name}
                          </span>
                          {pkg.savings && (
                            <span className="px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-xs font-bold">
                              {pkg.savings}
                            </span>
                          )}
                          {pkg.popular && (
                            <span className="px-2 py-0.5 rounded-md gradient-bg text-white text-xs font-bold">
                              Most Popular
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pkg.desc}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{pkg.price}</p>
                        <p className="text-xs text-muted-foreground">
                          {pkg.credits} credits
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleFinish}
                    className="flex-1 py-3 rounded-xl glass hover:bg-white/10 text-sm font-medium transition"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={() => {
                      window.location.href = "/dashboard/credits";
                    }}
                    className="flex-1 py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
                  >
                    Buy Credits
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Or add a card for pay-as-you-go at $12 per property from your
                  dashboard.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
