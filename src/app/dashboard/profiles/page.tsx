"use client";

import { useState, useEffect } from "react";
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
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: "",
    verticalTolerance: 1.0,
    sharpnessThreshold: 100,
    isDefault: false,
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (err) {
      console.error("Failed to fetch profiles:", err);
    }
  };

  const handleSetDefault = async (profileId: string) => {
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error("Failed to set default");
      fetchProfiles();
    } catch (err) {
      console.error("Failed to set default profile:", err);
    }
  };

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
      fetchProfiles();
    } catch (err) {
      console.error("Failed to create profile:", err);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="flex items-end justify-between mb-6"
      >
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            Configure
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Style Profiles{" "}
            <span className="font-mono text-muted-foreground/60 text-base ml-1">
              {profiles.length}
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          New Profile
        </button>
      </motion.div>

      {/* How it works strip */}
      <motion.div
        variants={fadeUp}
        className="panel hairline-top mesh-gradient p-5 mb-6 flex items-start gap-4"
      >
        <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm mb-1">How Style Profiles Work</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Upload 20 to 50 of your best, approved photos as reference. The
            engine analyzes color temperature, saturation, contrast, exposure,
            and composition patterns. This becomes your baseline. Every future
            QC check compares against YOUR standard, not a generic one.
          </p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {[
              { icon: Thermometer, label: "Color Temp" },
              { icon: Sun, label: "Exposure" },
              { icon: Contrast, label: "Contrast" },
              { icon: Aperture, label: "Sharpness" },
              { icon: Ruler, label: "Verticals" },
            ].map((item) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono"
              >
                <item.icon className="w-3 h-3" strokeWidth={1.75} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <motion.div
          variants={fadeUp}
          className="panel hairline-top dot-pattern py-16 px-8 text-center"
        >
          <div className="w-12 h-12 rounded-md border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center mx-auto mb-4">
            <Palette className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium">No style profiles yet</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Create your first profile and upload reference photos to teach the
            engine your editing standard.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Create style profile
          </button>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          {profiles.map((profile) => {
            const isLearned = profile.colorTempAvg !== null;
            return (
              <a
                key={profile.id}
                href={`/dashboard/profiles/${profile.id}`}
                className="panel-hover hairline-top p-5 space-y-4 cursor-pointer block group relative"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <Palette className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">
                          {profile.name}
                        </h3>
                        {profile.isDefault ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-primary/15 text-primary">
                            Default
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSetDefault(profile.id);
                            }}
                            title="Make this the default profile for new properties"
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[hsl(var(--surface-1))] text-muted-foreground border border-border hover:bg-primary/15 hover:text-primary hover:border-primary/30 transition-colors"
                          >
                            Set default
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {profile._count.clients} client
                        {profile._count.clients !== 1 ? "s" : ""} ·{" "}
                        {profile.referencePhotos.length} ref photos
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                      isLearned
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-[hsl(var(--surface-1))] text-muted-foreground"
                    }`}
                  >
                    {isLearned ? "Learned" : "Pending"}
                  </span>
                </div>

                {/* Parameters */}
                <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden border border-border">
                  {[
                    {
                      label: "Temp",
                      value: profile.colorTempAvg
                        ? `${Math.round(profile.colorTempAvg)}K`
                        : "--",
                    },
                    {
                      label: "Sat",
                      value: profile.saturationAvg
                        ? `${Math.round(profile.saturationAvg)}%`
                        : "--",
                    },
                    {
                      label: "V-Tol",
                      value: `${profile.verticalTolerance}\u00B0`,
                    },
                  ].map((param) => (
                    <div
                      key={param.label}
                      className="bg-[hsl(var(--surface-1))] p-2"
                    >
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {param.label}
                      </p>
                      <p className="text-sm font-mono stat-num font-semibold mt-0.5">
                        {param.value}
                      </p>
                    </div>
                  ))}
                </div>
              </a>
            );
          })}
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
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative panel hairline-top w-full max-w-lg p-6"
            >
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-md hover:bg-[hsl(var(--surface-3))] transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Create
              </p>
              <h2 className="text-lg font-semibold">New Style Profile</h2>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Name your profile and set base tolerances. Upload reference
                photos after creating it.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bright & Airy, Magazine Style"
                    value={newProfile.name}
                    onChange={(e) =>
                      setNewProfile({ ...newProfile, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md bg-[hsl(var(--surface-1))] border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30 transition"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">
                    Vertical Tolerance (degrees)
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    How many degrees off-vertical before flagging. Most agencies use 0.5 to 1.5.
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
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1 font-mono">
                    <span>Strict 0.25</span>
                    <span className="font-semibold text-foreground stat-num">
                      {newProfile.verticalTolerance.toFixed(2)}&deg;
                    </span>
                    <span>Loose 3.00</span>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProfile.isDefault}
                    onChange={(e) =>
                      setNewProfile({
                        ...newProfile,
                        isDefault: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 rounded accent-primary"
                  />
                  <span className="text-xs">
                    Set as default profile for new properties
                  </span>
                </label>

                <button
                  onClick={handleCreate}
                  disabled={!newProfile.name.trim()}
                  className="w-full py-2.5 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
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
