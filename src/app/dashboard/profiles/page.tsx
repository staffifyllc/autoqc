"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Plus,
  Settings2,
  Upload,
  CheckCircle2,
  Star,
  ChevronRight,
  X,
  Sliders,
  Thermometer,
  Sun,
  Contrast,
  Aperture,
  Ruler,
  Sparkles,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface StyleProfile {
  id: string;
  name: string;
  isDefault: boolean;
  colorTempAvg: number | null;
  saturationAvg: number | null;
  contrastAvg: number | null;
  exposureAvg: number | null;
  verticalTolerance: number;
  sharpnessThreshold: number;
  referencePhotos: string[];
  _count: { clients: number };
}

export default function ProfilesPage() {
  const [profiles] = useState<StyleProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: "",
    verticalTolerance: 1.0,
    sharpnessThreshold: 100,
    isDefault: false,
  });

  const handleCreate = async () => {
    try {
      await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProfile),
      });
      setShowCreate(false);
      setNewProfile({
        name: "",
        verticalTolerance: 1.0,
        sharpnessThreshold: 100,
        isDefault: false,
      });
      // Refresh profiles
    } catch (err) {
      console.error("Failed to create profile:", err);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold">Style Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define your agency&apos;s photo standards. QC checks run against these
            baselines.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </motion.div>

      {/* How it works card */}
      <motion.div
        variants={fadeUp}
        className="glass-card p-6 mb-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">How Style Profiles Work</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Upload 20-50 of your best, approved photos as reference. Our AI
              analyzes the color temperature, saturation, contrast, exposure, and
              composition patterns. This becomes your baseline. Every future QC
              check compares against YOUR standard, not a generic one.
            </p>
            <div className="flex items-center gap-6 mt-4">
              {[
                { icon: Thermometer, label: "Color Temp" },
                { icon: Sun, label: "Exposure" },
                { icon: Contrast, label: "Contrast" },
                { icon: Aperture, label: "Sharpness" },
                { icon: Ruler, label: "Verticals" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <motion.div
          variants={fadeUp}
          className="glass-card p-12 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Palette className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No style profiles yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Create your first profile and upload reference photos to teach the
            AI your editing standard.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Create Style Profile
          </button>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="glass-card-hover p-6 space-y-4 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <Palette className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{profile.name}</h3>
                      {profile.isDefault && (
                        <span className="px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-400 text-xs font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {profile._count.clients} client
                      {profile._count.clients !== 1 ? "s" : ""} using this
                      profile
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Color Temp",
                    value: profile.colorTempAvg
                      ? `${Math.round(profile.colorTempAvg)}K`
                      : "Not learned",
                  },
                  {
                    label: "Saturation",
                    value: profile.saturationAvg
                      ? `${Math.round(profile.saturationAvg)}%`
                      : "Not learned",
                  },
                  {
                    label: "Vertical Tol.",
                    value: `${profile.verticalTolerance} deg`,
                  },
                ].map((param) => (
                  <div
                    key={param.label}
                    className="text-center p-2 rounded-lg bg-white/3"
                  >
                    <p className="text-xs text-muted-foreground">
                      {param.label}
                    </p>
                    <p className="text-sm font-medium mt-0.5">{param.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="w-3.5 h-3.5" />
                {profile.referencePhotos.length} reference photos
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Create Profile Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative glass-card p-8 w-full max-w-lg"
            >
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-bold mb-1">New Style Profile</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Name your profile and set base tolerances. You can upload
                reference photos after creating it.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bright & Airy, Magazine Style"
                    value={newProfile.name}
                    onChange={(e) =>
                      setNewProfile({ ...newProfile, name: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Vertical Tolerance (degrees)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    How many degrees off-vertical before flagging. Most agencies use 0.5-1.5.
                  </p>
                  <input
                    type="range"
                    min="0.25"
                    max="3.0"
                    step="0.25"
                    value={newProfile.verticalTolerance}
                    onChange={(e) =>
                      setNewProfile({
                        ...newProfile,
                        verticalTolerance: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Strict (0.25)</span>
                    <span className="font-medium text-foreground">
                      {newProfile.verticalTolerance} deg
                    </span>
                    <span>Loose (3.0)</span>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProfile.isDefault}
                    onChange={(e) =>
                      setNewProfile({
                        ...newProfile,
                        isDefault: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded accent-brand-500"
                  />
                  <span className="text-sm">
                    Set as default profile for new properties
                  </span>
                </label>

                <button
                  onClick={handleCreate}
                  disabled={!newProfile.name.trim()}
                  className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  Create Profile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
