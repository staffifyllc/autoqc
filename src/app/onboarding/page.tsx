"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  ArrowRight,
  ArrowLeft,
  User,
  Building2,
  Sparkles,
  Coins,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const steps = [
  { id: "personal", label: "You", icon: User },
  { id: "business", label: "Business", icon: Building2 },
  { id: "style", label: "Style", icon: Sparkles },
  { id: "credits", label: "Credits", icon: Coins },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    // Personal
    firstName: "",
    lastName: "",
    phone: "",
    role: "OWNER",
    // Business
    agencyName: "",
    website: "",
    city: "",
    state: "",
    teamSize: "",
    propertiesMonth: "",
    yearsInBusiness: "",
    serviceTypes: [] as string[],
    currentPlatforms: [] as string[],
    referralSource: "",
    // Style
    styleProfileName: "Default Style",
  });

  const toggleArray = (field: "serviceTypes" | "currentPlatforms", value: string) => {
    setData((d) => ({
      ...d,
      [field]: d[field].includes(value)
        ? d[field].filter((v) => v !== value)
        : [...d[field], value],
    }));
  };

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finishOnboarding = async (skipCredits = false) => {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      window.location.href = skipCredits ? "/dashboard" : "/dashboard/credits";
    } catch (err) {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const personalValid = data.firstName.trim() && data.lastName.trim();
  const businessValid =
    data.agencyName.trim() &&
    data.teamSize &&
    data.propertiesMonth;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
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
                {i < step ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <s.icon className="w-3.5 h-3.5" />
                )}
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

        {/* Card */}
        <div className="glass-card p-8 min-h-[480px]">
          <AnimatePresence mode="wait">
            {/* STEP 1: PERSONAL */}
            {step === 0 && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-bold">Tell us about you</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    We use this to personalize your experience and for billing.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={data.firstName}
                      onChange={(e) =>
                        setData({ ...data, firstName: e.target.value })
                      }
                      placeholder="Paul"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={data.lastName}
                      onChange={(e) =>
                        setData({ ...data, lastName: e.target.value })
                      }
                      placeholder="Smith"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={data.phone}
                    onChange={(e) =>
                      setData({ ...data, phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Your Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "OWNER", label: "Owner" },
                      { id: "PHOTOGRAPHER", label: "Photographer" },
                      { id: "EDITOR", label: "Editor" },
                      { id: "MANAGER", label: "Manager" },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setData({ ...data, role: r.id })}
                        className={`py-2 px-3 rounded-xl text-sm font-medium transition ${
                          data.role === r.id
                            ? "bg-brand-500/20 border border-brand-500/40 text-brand-300"
                            : "glass hover:bg-white/10"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={next}
                  disabled={!personalValid}
                  className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: BUSINESS */}
            {step === 1 && (
              <motion.div
                key="business"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-bold">About your business</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Helps us tune QC for your workflow and volume.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={data.agencyName}
                    onChange={(e) =>
                      setData({ ...data, agencyName: e.target.value })
                    }
                    placeholder="WeShoot Photography"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Website
                    </label>
                    <input
                      type="url"
                      value={data.website}
                      onChange={(e) =>
                        setData({ ...data, website: e.target.value })
                      }
                      placeholder="yourcompany.com"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      City, State
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={data.city}
                        onChange={(e) =>
                          setData({ ...data, city: e.target.value })
                        }
                        placeholder="Tampa"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                      />
                      <input
                        type="text"
                        value={data.state}
                        onChange={(e) =>
                          setData({ ...data, state: e.target.value.toUpperCase().slice(0, 2) })
                        }
                        placeholder="FL"
                        maxLength={2}
                        className="w-14 px-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm uppercase text-center placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Team Size *
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {["1", "2-5", "6-10", "11-25", "26+"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setData({ ...data, teamSize: s })}
                        className={`py-2 rounded-xl text-sm font-medium transition ${
                          data.teamSize === s
                            ? "bg-brand-500/20 border border-brand-500/40 text-brand-300"
                            : "glass hover:bg-white/10"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Properties per month *
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: "<10", label: "<10" },
                      { id: "10-25", label: "10-25" },
                      { id: "26-50", label: "26-50" },
                      { id: "51-100", label: "51-100" },
                      { id: "100+", label: "100+" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setData({ ...data, propertiesMonth: s.id })}
                        className={`py-2 rounded-xl text-sm font-medium transition ${
                          data.propertiesMonth === s.id
                            ? "bg-brand-500/20 border border-brand-500/40 text-brand-300"
                            : "glass hover:bg-white/10"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Services you offer (select all)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "residential", label: "Residential" },
                      { id: "commercial", label: "Commercial" },
                      { id: "drone", label: "Drone" },
                      { id: "video", label: "Video" },
                      { id: "3d", label: "3D / Matterport" },
                      { id: "twilight", label: "Twilight" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleArray("serviceTypes", s.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          data.serviceTypes.includes(s.id)
                            ? "bg-brand-500/20 border border-brand-500/40 text-brand-300"
                            : "glass hover:bg-white/10"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">
                    Current delivery platform (select any you use)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "aryeo", label: "Aryeo" },
                      { id: "hdphotohub", label: "HDPhotoHub" },
                      { id: "spiro", label: "Spiro" },
                      { id: "tonomo", label: "Tonomo" },
                      { id: "dropbox", label: "Dropbox" },
                      { id: "none", label: "None yet" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleArray("currentPlatforms", p.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          data.currentPlatforms.includes(p.id)
                            ? "bg-brand-500/20 border border-brand-500/40 text-brand-300"
                            : "glass hover:bg-white/10"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">
                    How did you hear about AutoQC?
                  </label>
                  <select
                    value={data.referralSource}
                    onChange={(e) =>
                      setData({ ...data, referralSource: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                  >
                    <option value="">Select one</option>
                    <option value="facebook">Facebook group</option>
                    <option value="instagram">Instagram</option>
                    <option value="google">Google search</option>
                    <option value="youtube">YouTube</option>
                    <option value="referral">Referral from photographer</option>
                    <option value="podcast">Podcast / article</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    className="px-4 py-3 rounded-xl glass hover:bg-white/10 text-sm font-medium transition flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={next}
                    disabled={!businessValid}
                    className="flex-1 py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: STYLE */}
            {step === 2 && (
              <motion.div
                key="style"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-bold">Create your style profile</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pick a name. You can upload reference photos from the dashboard to teach AutoQC your editing standard.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Style Name
                  </label>
                  <input
                    type="text"
                    value={data.styleProfileName}
                    onChange={(e) =>
                      setData({ ...data, styleProfileName: e.target.value })
                    }
                    placeholder="Bright & Airy, Magazine, Natural..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    autoFocus
                  />
                </div>

                <div className="glass-card p-4 bg-blue-500/5 border-blue-500/20">
                  <div className="flex gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">
                        Upload reference photos later
                      </p>
                      <p className="text-xs">
                        After onboarding, upload 20-50 of your approved photos. AutoQC will analyze them and tune QC to match your style exactly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    className="px-4 py-3 rounded-xl glass hover:bg-white/10 text-sm font-medium transition flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={next}
                    className="flex-1 py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: CREDITS */}
            {step === 3 && (
              <motion.div
                key="credits"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-bold">Buy credits to start processing</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Payment is required before processing. Credits save you money vs pay-as-you-go.
                  </p>
                </div>

                <div className="space-y-2">
                  {[
                    { name: "Starter", credits: 10, price: "$100", desc: "10 properties at $10 each" },
                    { name: "Professional", credits: 25, price: "$225", desc: "25 properties at $9 each", savings: "Save 10%" },
                    { name: "Agency", credits: 50, price: "$425", desc: "50 properties at $8.50 each", savings: "Save 15%", popular: true },
                  ].map((pkg) => (
                    <button
                      key={pkg.name}
                      onClick={() => finishOnboarding(false)}
                      disabled={loading}
                      className={`w-full p-4 rounded-xl text-left transition flex items-center justify-between disabled:opacity-50 ${
                        pkg.popular
                          ? "bg-brand-500/10 border border-brand-500/30 hover:bg-brand-500/20"
                          : "glass hover:bg-white/10"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{pkg.name}</span>
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

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={prev}
                    className="px-4 py-3 rounded-xl glass hover:bg-white/10 text-sm font-medium transition flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={() => finishOnboarding(true)}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl glass hover:bg-white/10 text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Skip for now
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  You can also add a pay-as-you-go card at $12/property from your dashboard.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
