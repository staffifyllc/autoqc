"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
  Send,
  Eye,
  RotateCcw,
  ChevronDown,
  X,
  Download,
  Maximize2,
  Upload,
} from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { downloadPhotoZip, downloadFile } from "@/lib/photoZip";
import { DistractionCategoriesPanel } from "@/components/dashboard/DistractionCategoriesPanel";
import { prettyDistractionLabel } from "@/lib/distractionCategories";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "text-gray-400", bg: "bg-gray-500/10" },
  PROCESSING: { label: "Processing", color: "text-blue-400", bg: "bg-blue-500/10" },
  PASSED: { label: "Passed", color: "text-green-400", bg: "bg-green-500/10" },
  FIXED: { label: "Auto-Fixed", color: "text-amber-400", bg: "bg-amber-500/10" },
  FLAGGED: { label: "Flagged", color: "text-red-400", bg: "bg-red-500/10" },
  APPROVED: { label: "Approved", color: "text-green-400", bg: "bg-green-500/10" },
  REJECTED: { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10" },
};

// Helper to get tier from a photo's full analysis
const getTier = (photo: any): string | null =>
  photo?.issues?._full_analysis?.overall?.tier || null;

const tierConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  premium: {
    label: "Premium",
    color: "text-yellow-300",
    bg: "bg-gradient-to-br from-yellow-500/30 to-amber-500/20 border border-yellow-500/40",
    emoji: "★",
  },
  pass_high: { label: "Pass (High)", color: "text-green-300", bg: "bg-green-500/10", emoji: "" },
  pass: { label: "Pass", color: "text-green-400", bg: "bg-green-500/10", emoji: "" },
  pass_low: { label: "Pass (Low)", color: "text-amber-400", bg: "bg-amber-500/10", emoji: "" },
  minor_fail: { label: "Minor Fail", color: "text-amber-400", bg: "bg-amber-500/15", emoji: "" },
  major_fail: { label: "Major Fail", color: "text-red-400", bg: "bg-red-500/15", emoji: "" },
  reject: { label: "Reject", color: "text-red-300", bg: "bg-red-500/20", emoji: "" },
};

const issueLabels: Record<string, string> = {
  vertical_tilt: "Vertical Tilt",
  horizon_tilt: "Horizon Tilt",
  color_temp: "Color Temperature",
  overexposed: "Overexposed",
  underexposed: "Underexposed",
  soft_focus: "Soft / Blurry",
  chromatic_aberration: "Chromatic Aberration",
  lens_distortion: "Lens Distortion",
  composition: "Composition Issue",
  reflection: "Photographer Reflection",
  toilet_visible: "Toilet Lid Up",
  clutter: "Clutter Detected",
  consistency: "Style Inconsistency",
  window_blowout: "Window Blowout",
  hdr_artifact: "HDR Artifact",
  sky_issue: "Sky Issue",
};

interface Photo {
  id: string;
  fileName: string;
  status: string;
  qcScore: number | null;
  verticalDev: number | null;
  horizonDev: number | null;
  colorTemp: number | null;
  exposure: number | null;
  sharpness: number | null;
  saturation: number | null;
  issues: Record<string, any> | null;
  aiNotes: string | null;
  fixesApplied: string[];
  useOriginal: boolean;
  originalUrl?: string;
  fixedUrl?: string | null;
}

export default function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [property, setProperty] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [zipProgress, setZipProgress] = useState<{
    phase: string;
    done: number;
    total: number;
    current?: string;
  } | null>(null);

  useEffect(() => {
    fetchProperty();
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("upload") === "true") {
        setShowUploader(true);
      }
    }
  }, [params.id]);

  // Auto-refresh every 3 seconds while anything is processing
  useEffect(() => {
    if (!property) return;
    const anyProcessing =
      property.status === "PROCESSING" ||
      property.photos?.some((p: any) => p.status === "PROCESSING");
    if (!anyProcessing) return;

    const interval = setInterval(() => {
      fetchProperty();
    }, 3000);
    return () => clearInterval(interval);
  }, [property]);

  // Keyboard navigation in photo modal: Esc to close, arrows to navigate
  useEffect(() => {
    if (!selectedPhoto || !property) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedPhoto(null);
        return;
      }

      // Use filtered photos (respects current tab filter) for navigation
      const list = filteredPhotos || property.photos;
      if (!list || list.length === 0) return;

      const currentIndex = list.findIndex(
        (p: Photo) => p.id === selectedPhoto.id
      );
      if (currentIndex === -1) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = list[(currentIndex - 1 + list.length) % list.length];
        setSelectedPhoto(prev);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = list[(currentIndex + 1) % list.length];
        setSelectedPhoto(next);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, property, filter]);

  const fetchProperty = async () => {
    try {
      const res = await fetch(`/api/properties/${params.id}`);
      const data = await res.json();
      setProperty(data.property);
    } catch (err) {
      console.error("Failed to fetch property:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoAction = async (photoId: string, status: string) => {
    try {
      await fetch(
        `/api/properties/${params.id}/photos/${photoId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      fetchProperty();
      setSelectedPhoto(null);
    } catch (err) {
      console.error("Failed to update photo:", err);
    }
  };

  // Flip the useOriginal flag so exports / pushes / the grid all serve
  // the original bytes instead of s3KeyFixed. Keeps the fixed artifact
  // around so the user can flip back without re-queueing QC.
  const handleToggleUseOriginal = async (
    photoId: string,
    nextValue: boolean
  ) => {
    try {
      await fetch(`/api/properties/${params.id}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useOriginal: nextValue }),
      });
      // Optimistic update so the button state flips instantly in the modal.
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto({ ...selectedPhoto, useOriginal: nextValue });
      }
      fetchProperty();
    } catch (err) {
      console.error("Failed to toggle useOriginal:", err);
    }
  };

  const handlePush = async (platform: string) => {
    try {
      await fetch("/api/integrations/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: params.id,
          platform,
        }),
      });
      fetchProperty();
    } catch (err) {
      console.error("Failed to push:", err);
    }
  };

  const filteredPhotos = property?.photos?.filter((p: Photo) => {
    if (filter === "all") return true;
    if (filter === "premium") return getTier(p) === "premium";
    if (filter === "issues") return ["FLAGGED", "FIXED"].includes(p.status);
    if (filter === "passed") return p.status === "PASSED";
    return p.status === filter.toUpperCase();
  });

  const passCount = property?.photos?.filter(
    (p: Photo) => p.status === "PASSED" || p.status === "APPROVED"
  ).length || 0;
  const fixedCount = property?.photos?.filter(
    (p: Photo) => p.status === "FIXED"
  ).length || 0;
  const flaggedCount = property?.photos?.filter(
    (p: Photo) => p.status === "FLAGGED"
  ).length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-6">
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-3 font-mono uppercase tracking-wider"
        >
          <ArrowLeft className="w-3 h-3" />
          Properties
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {property.address}
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-1.5 flex items-center gap-2">
              <span>{property.photos.length} photos</span>
              {property.client && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{property.client.clientName}</span>
                </>
              )}
              {property.tier === "PREMIUM" && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-yellow-300/80">★ Premium</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!showUploader && (
              <button
                onClick={() => setShowUploader(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))] text-sm font-medium transition"
              >
                <Upload className="w-3.5 h-3.5" />
                {property.photos.length === 0 ? "Upload Photos" : "Add Photos"}
              </button>
            )}
            {property.status === "APPROVED" && (
              <button
                onClick={() => handlePush("ARYEO")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition glow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Push to Platform
              </button>
            )}
            {property.photos.length > 0 &&
              property.status !== "PROCESSING" && (
                <button
                  onClick={async () => {
                    const res = await fetch(
                      `/api/properties/${params.id}`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "run_qc" }),
                      }
                    );
                    if (res.status === 402) {
                      const data = await res.json();
                      alert(
                        data.message ||
                          "Payment required. Add credits or payment method."
                      );
                      window.location.href = "/dashboard/credits";
                      return;
                    }
                    if (!res.ok) {
                      const data = await res.json();
                      alert(data.error || "Failed to start QC");
                      return;
                    }
                    fetchProperty();
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                    property.status === "PENDING"
                      ? "accent-bg hover:opacity-90 glow-sm"
                      : "border border-border bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))]"
                  }`}
                >
                  {property.status === "PENDING" ? (
                    <>
                      <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Run QC on {property.photos.length} Photo
                      {property.photos.length !== 1 ? "s" : ""}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Re-run QC
                    </>
                  )}
                </button>
              )}
            {/* Export dropdown - 3 options */}
            {property.photos.length > 0 &&
              property.photos.some((p: Photo) => p.qcScore !== null) && (
                <ExportButton
                  propertyId={params.id}
                  propertyAddress={property.address || "AutoQC_export"}
                  zipProgress={zipProgress}
                  setZipProgress={setZipProgress}
                />
              )}
            {/* Apply All / Approve All - accepts auto-fixes + marks flagged as approved */}
            {property.photos.length > 0 &&
              (property.status === "REVIEW" ||
                property.photos.some((p: Photo) =>
                  ["FIXED", "FLAGGED"].includes(p.status)
                )) && (
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        "Accept all auto-fixes and approve all photos? You can also click individual photos to review first."
                      )
                    )
                      return;
                    await fetch(`/api/properties/${params.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve_all" }),
                    });
                    fetchProperty();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition glow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Apply All Changes
                </button>
              )}
          </div>
        </div>
      </motion.div>

      {/* Upload section - shows when user clicks upload OR property has no photos yet */}
      {showUploader && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">
                {property.photos.length === 0
                  ? "Upload photos to get started"
                  : "Add more photos"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your progress is saved. You can leave this page and come back
                anytime.
              </p>
            </div>
            {property.photos.length > 0 && (
              <button
                onClick={() => setShowUploader(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <PhotoUploader
            propertyId={params.id}
            propertyAddress={property.address}
            onComplete={() => {
              setShowUploader(false);
              fetchProperty();
            }}
          />
        </motion.div>
      )}

      {/* PENDING state - prominent "Run QC" banner */}
      {property.status === "PENDING" && property.photos.length > 0 && (
        <motion.div
          variants={fadeUp}
          className="panel hairline-top p-5 mb-5 border-primary/30 bg-primary/[0.04]"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Ready to run QC</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {property.photos.length} photos uploaded. Processing takes about
                30 to 60 seconds.
              </p>
            </div>
            <button
              onClick={async () => {
                const res = await fetch(`/api/properties/${params.id}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "run_qc" }),
                });
                if (res.status === 402) {
                  const data = await res.json();
                  alert(
                    data.message ||
                      "Payment required. Add credits or payment method."
                  );
                  window.location.href = "/dashboard/credits";
                  return;
                }
                if (!res.ok) {
                  const data = await res.json();
                  alert(data.error || "Failed to start QC");
                  return;
                }
                fetchProperty();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md accent-bg text-sm font-semibold hover:opacity-90 transition glow"
            >
              <Zap className="w-4 h-4" strokeWidth={2.5} />
              Start Quality Check
            </button>
          </div>
        </motion.div>
      )}

      {/* Room Coverage Check - suggests missing essential room types */}
      {(() => {
        const roomTypes = new Set(
          property.photos
            .map((p: Photo) => (p as any).issues?._room_type)
            .filter(Boolean)
        );
        if (roomTypes.size === 0) return null;

        const essential = [
          { id: "kitchen", label: "Kitchen" },
          { id: "living_room", label: "Living Room" },
          { id: "bedroom", label: "Bedroom" },
          { id: "bathroom", label: "Bathroom" },
          { id: "exterior_front", label: "Exterior Front" },
        ];
        const missing = essential.filter((r) => !roomTypes.has(r.id));
        if (missing.length === 0) return null;

        return (
          <motion.div
            variants={fadeUp}
            className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 mb-5"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-200">
                  Possibly missing room photos:{" "}
                  <span className="text-amber-100/80 font-mono">
                    {missing.map((r) => r.label).join(", ")}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Tier Breakdown - if any photos have tiers */}
      {(() => {
        const tierCounts: Record<string, number> = {};
        property.photos.forEach((p: Photo) => {
          const t = getTier(p);
          if (t) tierCounts[t] = (tierCounts[t] || 0) + 1;
        });
        const hasAnyTiers = Object.keys(tierCounts).length > 0;
        if (!hasAnyTiers) return null;

        return (
          <motion.div variants={fadeUp} className="panel hairline-top p-5 mb-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
              Quality Tier Breakdown
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                "premium",
                "pass_high",
                "pass",
                "pass_low",
                "minor_fail",
                "major_fail",
                "reject",
              ].map((tier) => {
                const count = tierCounts[tier] || 0;
                if (count === 0) return null;
                const t = tierConfig[tier];
                return (
                  <div
                    key={tier}
                    className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded border ${t.bg.replace(
                      "bg-",
                      "border-"
                    )}/40 ${t.bg}`}
                  >
                    {t.emoji && (
                      <span className={`text-[11px] ${t.color}`}>
                        {t.emoji}
                      </span>
                    )}
                    <span
                      className={`font-mono stat-num text-xs font-semibold ${t.color}`}
                    >
                      {count}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}

      {/* Summary Stats */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border mb-6"
      >
        {[
          {
            label: "QC Score",
            value:
              property.totalQcScore !== null
                ? Math.round(property.totalQcScore).toString()
                : "--",
            tone: "text-foreground",
            suffix:
              property.totalQcScore !== null ? (
                <span className="text-[11px] text-muted-foreground ml-0.5">
                  /100
                </span>
              ) : null,
          },
          {
            label: "Passed",
            value: passCount.toString(),
            tone: "text-emerald-300",
          },
          {
            label: "Auto-Fixed",
            value: fixedCount.toString(),
            tone: "text-amber-300",
          },
          {
            label: "Flagged",
            value: flaggedCount.toString(),
            tone: "text-red-300",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[hsl(var(--surface-2))] p-4 hairline-top"
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <div className="mt-1.5 flex items-baseline">
              <span
                className={`font-mono stat-num text-2xl font-semibold ${s.tone}`}
              >
                {s.value}
              </span>
              {(s as any).suffix}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Summary of Changes - per-property fix report */}
      {(() => {
        const fixSummary: Record<string, number> = {};
        const blurredCount = property.photos.filter(
          (p: Photo) => (p as any).issues?.privacy_blurred
        ).length;

        property.photos.forEach((p: Photo) => {
          const fixes = p.fixesApplied || [];
          fixes.forEach((f) => {
            // Group by fix type (strip numbers for aggregation)
            const cat = f
              .replace(/\(.*?\)/g, "")
              .replace(/\d+(\.\d+)?/g, "")
              .trim();
            fixSummary[cat] = (fixSummary[cat] || 0) + 1;
          });
        });

        const totalFixes = Object.values(fixSummary).reduce(
          (a, b) => a + b,
          0
        );
        if (totalFixes === 0 && blurredCount === 0) return null;

        return (
          <motion.div variants={fadeUp} className="panel hairline-top p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Summary of Changes
              </p>
              <span className="text-[10px] font-mono text-muted-foreground/70">
                {totalFixes} adjustments ·{" "}
                {
                  property.photos.filter((p: Photo) => p.fixesApplied?.length)
                    .length
                }{" "}
                photos
                {blurredCount > 0 ? ` · ${blurredCount} blurred` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(fixSummary).map(([fixType, count]) => (
                <div
                  key={fixType}
                  className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded border border-amber-500/20 bg-amber-500/5"
                >
                  <span className="font-mono stat-num text-xs font-semibold text-amber-300">
                    {count}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fixType}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Distractions Removed - Premium feature summary */}
      {(() => {
        // Aggregate per-type counts across all photos.
        const perType: Record<string, number> = {};
        let photosTouched = 0;
        let totalRegions = 0;
        property.photos.forEach((p: Photo) => {
          const d = (p as any).issues?.distractions_removed;
          if (!d) return;
          photosTouched += 1;
          totalRegions += d.region_count || 0;
          const pt: Record<string, number> = d.per_type || {};
          Object.entries(pt).forEach(([k, v]) => {
            perType[k] = (perType[k] || 0) + (v as number);
          });
        });
        if (totalRegions === 0) return null;

        return (
          <motion.div variants={fadeUp} className="panel hairline-top p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Distractions Removed
                </p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  AI detected and inpainted transient clutter from the listing
                  photos.
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/70">
                {totalRegions} item{totalRegions !== 1 ? "s" : ""} ·{" "}
                {photosTouched} photo{photosTouched !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(perType).map(([cat, count]) => (
                <div
                  key={cat}
                  className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded border border-emerald-500/25 bg-emerald-500/5"
                >
                  <span className="font-mono stat-num text-xs font-semibold text-emerald-300">
                    {count}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {prettyDistractionLabel(cat)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Distraction removal settings + Standard-tier upsell */}
      <DistractionSettings
        propertyId={params.id}
        tier={property.tier}
        initial={(property as any).distractionCategories || []}
        photos={property.photos}
        onChanged={fetchProperty}
      />

      {/* Filter tabs */}
      <motion.div variants={fadeUp} className="mb-5">
        <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-[hsl(var(--surface-2))] border border-border">
          {(() => {
            const premiumCount = property.photos.filter(
              (p: Photo) => getTier(p) === "premium"
            ).length;
            const tabs = [
              { key: "all", label: "All", count: property.photos.length },
              { key: "passed", label: "Passed", count: passCount },
              {
                key: "issues",
                label: "Issues",
                count: fixedCount + flaggedCount,
              },
              { key: "flagged", label: "Flagged", count: flaggedCount },
            ];
            if (premiumCount > 0) {
              tabs.splice(1, 0, {
                key: "premium",
                label: "★ Premium",
                count: premiumCount,
              });
            }
            return tabs;
          })().map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[hsl(var(--surface-3))] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}{" "}
                <span
                  className={`ml-1 font-mono text-[10px] ${
                    isActive
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Photo Grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-3">
        {filteredPhotos?.map((photo: Photo) => {
          const status = statusConfig[photo.status] || statusConfig.PENDING;
          const hasIssues =
            photo.issues && Object.keys(photo.issues).length > 0;

          return (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative rounded-md overflow-hidden border border-border hover:border-primary/40 focus:border-primary/60 transition-colors duration-150 aspect-[4/3] bg-[hsl(var(--surface-2))]"
            >
              {/* Actual image thumbnail */}
              {(photo as any).thumbnailUrl ? (
                <img
                  src={(photo as any).thumbnailUrl}
                  alt={photo.fileName}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground px-2 text-center">
                    {photo.fileName}
                  </span>
                </div>
              )}

              {/* Subtle gradient overlay for badge readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

              {/* Tier badge takes precedence over status if available */}
              {(() => {
                const tier = getTier(photo);
                if (tier && tierConfig[tier]) {
                  const t = tierConfig[tier];
                  return (
                    <div
                      className={`absolute top-2 right-2 px-2 py-1 rounded-lg ${t.bg} ${t.color} text-xs font-bold backdrop-blur-sm flex items-center gap-1 ${
                        tier === "premium" ? "shadow-lg shadow-yellow-500/30" : ""
                      }`}
                    >
                      {t.emoji && <span>{t.emoji}</span>}
                      {t.label}
                    </div>
                  );
                }
                return (
                  <div
                    className={`absolute top-2 right-2 px-2 py-1 rounded-lg ${status.bg} ${status.color} text-xs font-medium backdrop-blur-sm`}
                  >
                    {status.label}
                  </div>
                );
              })()}

              {/* Before/After badge - shows when this photo has an auto-fix */}
              {(photo as any).fixedUrl && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold backdrop-blur-sm flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Before/After
                </div>
              )}

              {/* Privacy blur badge */}
              {(photo as any).issues?.privacy_blurred && (
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold backdrop-blur-sm flex items-center gap-1">
                  <span>🛡</span>
                  Privacy
                </div>
              )}

              {/* Distractions removed badge */}
              {(photo as any).issues?.distractions_removed?.region_count >
                0 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold backdrop-blur-sm flex items-center gap-1 font-mono">
                  {(photo as any).issues.distractions_removed.region_count}{" "}
                  cleaned
                </div>
              )}

              {/* QC score */}
              {photo.qcScore !== null && (
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[11px] font-mono stat-num font-semibold text-white">
                  {Math.round(photo.qcScore)}
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        })}
      </motion.div>

      {/* Photo Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedPhoto(null)}
            />

            {/* Previous arrow button */}
            {(() => {
              const list = filteredPhotos || property?.photos || [];
              if (list.length <= 1) return null;
              const currentIndex = list.findIndex(
                (p: Photo) => p.id === selectedPhoto.id
              );
              if (currentIndex === -1) return null;
              return (
                <button
                  onClick={() => {
                    const prev =
                      list[(currentIndex - 1 + list.length) % list.length];
                    setSelectedPhoto(prev);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full glass hover:bg-white/20 transition flex items-center justify-center"
                  aria-label="Previous photo"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              );
            })()}

            {/* Next arrow button */}
            {(() => {
              const list = filteredPhotos || property?.photos || [];
              if (list.length <= 1) return null;
              const currentIndex = list.findIndex(
                (p: Photo) => p.id === selectedPhoto.id
              );
              if (currentIndex === -1) return null;
              return (
                <button
                  onClick={() => {
                    const next = list[(currentIndex + 1) % list.length];
                    setSelectedPhoto(next);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full glass hover:bg-white/20 transition flex items-center justify-center"
                  aria-label="Next photo"
                >
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              );
            })()}

            {/* Keyboard shortcuts hint */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-xs text-muted-foreground border border-white/10">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
                ESC
              </kbd>
              close
              <span className="mx-1 opacity-50">·</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
                ←
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
                →
              </kbd>
              navigate
              {(() => {
                const list = filteredPhotos || property?.photos || [];
                const currentIndex = list.findIndex(
                  (p: Photo) => p.id === selectedPhoto.id
                );
                if (currentIndex === -1 || list.length <= 1) return null;
                return (
                  <>
                    <span className="mx-1 opacity-50">·</span>
                    <span>
                      {currentIndex + 1} of {list.length}
                    </span>
                  </>
                );
              })()}
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="relative flex w-full max-w-6xl mx-auto my-8"
            >
              {/* Image area */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
                {(() => {
                  const origSrc =
                    selectedPhoto.originalUrl ||
                    (selectedPhoto as any).thumbnailUrl;
                  const fixedSrc = selectedPhoto.fixedUrl;
                  const hasFix = Boolean(fixedSrc);

                  if (!origSrc) {
                    return (
                      <div className="w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <span className="text-muted-foreground">
                          {selectedPhoto.fileName}
                        </span>
                      </div>
                    );
                  }

                  // Always render a slider. When there is no fix, feed the
                  // original as itemTwo so the slider still draws but both
                  // halves show the same image. A "No changes applied" pill
                  // makes the reason explicit.
                  const itemTwoSrc = hasFix ? (fixedSrc as string) : origSrc;

                  return (
                    <>
                      <div className="relative w-full max-h-[75vh] rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
                        <ReactCompareSlider
                          itemOne={
                            <ReactCompareSliderImage
                              src={origSrc}
                              alt="Original"
                            />
                          }
                          itemTwo={
                            <ReactCompareSliderImage
                              src={itemTwoSrc}
                              alt={hasFix ? "Fixed" : "Original (no changes)"}
                            />
                          }
                          className="rounded-xl"
                        />
                        {!hasFix && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 border border-white/10 text-[10px] font-mono uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            No changes applied
                          </div>
                        )}
                        {hasFix && selectedPhoto.useOriginal && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500/80 border border-amber-400/60 text-[10px] font-mono uppercase tracking-wider text-white backdrop-blur-sm flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" />
                            Exporting original
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between w-full max-w-md text-xs">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                          <span className="text-muted-foreground">←</span>
                          <span className="font-medium">Original</span>
                        </div>
                        <span className="text-muted-foreground text-center">
                          {hasFix
                            ? "Drag the slider to compare"
                            : "Photo passed QC without edits"}
                        </span>
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                            hasFix
                              ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                              : "bg-white/5 border border-white/10 text-muted-foreground"
                          }`}
                        >
                          <span className="font-medium">
                            {hasFix ? "Auto-Fixed" : "Unchanged"}
                          </span>
                          <span>→</span>
                        </div>
                      </div>

                      {/* Download + revert buttons */}
                      <div className="flex flex-wrap items-center gap-2 justify-center">
                        <button
                          onClick={() =>
                            downloadFile(
                              origSrc as string,
                              `original_${selectedPhoto.fileName}`
                            )
                          }
                          className="text-xs px-3 py-1.5 rounded-lg glass hover:bg-white/10 transition flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          {hasFix ? "Original" : "Download"}
                        </button>
                        {hasFix && (
                          <button
                            onClick={() =>
                              downloadFile(
                                fixedSrc as string,
                                `fixed_${selectedPhoto.fileName}`
                              )
                            }
                            className="text-xs px-3 py-1.5 rounded-lg gradient-bg text-white hover:opacity-90 transition flex items-center gap-1.5"
                          >
                            <Download className="w-3 h-3" />
                            Fixed Version
                          </button>
                        )}
                        {hasFix && (
                          <button
                            onClick={() =>
                              handleToggleUseOriginal(
                                selectedPhoto.id,
                                !selectedPhoto.useOriginal
                              )
                            }
                            title={
                              selectedPhoto.useOriginal
                                ? "Use the auto-fixed version again for export and push"
                                : "Don't use the auto-fix. Keep the original for export and push."
                            }
                            className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 border ${
                              selectedPhoto.useOriginal
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
                                : "glass border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {selectedPhoto.useOriginal
                              ? "Restore auto-fix"
                              : "Revert to original"}
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Detail panel */}
              <div className="w-96 glass-card p-6 overflow-y-auto m-4 rounded-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate pr-4">
                    {selectedPhoto.fileName}
                  </h3>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* QC Score */}
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <p className="text-4xl font-bold gradient-text">
                    {selectedPhoto.qcScore !== null
                      ? Math.round(selectedPhoto.qcScore)
                      : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    QC Score
                  </p>
                </div>

                {/* Technical metrics */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Technical Metrics</h4>
                  <div className="space-y-2">
                    {[
                      {
                        label: "Vertical Deviation",
                        value: selectedPhoto.verticalDev,
                        unit: "deg",
                        threshold: 1.0,
                      },
                      {
                        label: "Horizon Deviation",
                        value: selectedPhoto.horizonDev,
                        unit: "deg",
                        threshold: 0.5,
                      },
                      {
                        label: "Color Temperature",
                        value: selectedPhoto.colorTemp,
                        unit: "K",
                      },
                      {
                        label: "Exposure",
                        value: selectedPhoto.exposure,
                        unit: "EV",
                      },
                      {
                        label: "Sharpness",
                        value: selectedPhoto.sharpness,
                        unit: "",
                      },
                      {
                        label: "Saturation",
                        value: selectedPhoto.saturation,
                        unit: "%",
                      },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/3"
                      >
                        <span className="text-xs text-muted-foreground">
                          {metric.label}
                        </span>
                        <span
                          className={`text-xs font-mono font-medium ${
                            metric.threshold &&
                            metric.value &&
                            Math.abs(metric.value) > metric.threshold
                              ? "text-red-400"
                              : "text-foreground"
                          }`}
                        >
                          {metric.value !== null
                            ? `${metric.value.toFixed(1)}${metric.unit}`
                            : "--"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Room type + ethics flag if present */}
                {selectedPhoto.issues?._room_type && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/3 text-xs">
                    <span className="text-muted-foreground">Detected:</span>
                    <span className="font-medium capitalize">
                      {String(selectedPhoto.issues._room_type).replace("_", " ")}
                    </span>
                  </div>
                )}

                {selectedPhoto.issues?._full_analysis?.categories?.ethics
                  ?.high_risk && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium text-red-300">
                        Ethics Risk
                      </span>
                    </div>
                    <p className="text-xs text-red-400/80">
                      {selectedPhoto.issues._full_analysis.categories.ethics
                        .detail ||
                        "Possible misrepresentation - review before listing."}
                    </p>
                  </div>
                )}

                {/* Category Breakdown (9 RE Photography Categories) */}
                {selectedPhoto.issues?._full_analysis?.categories && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      Category Breakdown
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(
                        selectedPhoto.issues._full_analysis.categories
                      ).map(([catName, catData]: [string, any]) => {
                        const score = catData.score || 0;
                        const color =
                          score >= 80
                            ? "text-green-400"
                            : score >= 60
                            ? "text-amber-400"
                            : "text-red-400";
                        const bg =
                          score >= 80
                            ? "bg-green-500/5"
                            : score >= 60
                            ? "bg-amber-500/5"
                            : "bg-red-500/5";
                        return (
                          <div
                            key={catName}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg ${bg}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium capitalize">
                                {catName.replace(/_/g, " ")}
                              </p>
                              {catData.detail && score < 80 && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {catData.detail}
                                </p>
                              )}
                            </div>
                            <span className={`text-sm font-bold ${color}`}>
                              {score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Adjustments applied automatically */}
                {Array.isArray((selectedPhoto.issues as any)?._applied_actions) &&
                  (selectedPhoto.issues as any)._applied_actions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Auto-adjustments applied
                      </h4>
                      <div className="space-y-1.5">
                        {(selectedPhoto.issues as any)._applied_actions.map(
                          (a: any, i: number) => {
                            const sign = Number(a.amount) >= 0 ? "+" : "";
                            const label = a.channel
                              ? `${a.op} (${a.channel})`
                              : a.op;
                            return (
                              <div
                                key={i}
                                className="flex items-start gap-2 py-2 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15"
                              >
                                <span className="text-emerald-400 shrink-0 mt-0.5">
                                  ✓
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-emerald-200">
                                      {String(label).replace(/_/g, " ")}
                                    </span>
                                    <span className="font-mono text-emerald-300/80">
                                      {sign}
                                      {Number(a.amount).toFixed(2)}
                                    </span>
                                  </div>
                                  {a.reason && (
                                    <p className="text-[11px] text-emerald-300/70 mt-0.5 leading-snug">
                                      {a.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                {/* Additional human-readable suggestions that are NOT
                    executable (crop, local brush work, etc). Only shown
                    when they add info beyond what was auto-applied. */}
                {selectedPhoto.issues?._fix_actions &&
                  Array.isArray(selectedPhoto.issues._fix_actions) &&
                  selectedPhoto.issues._fix_actions.length > 0 &&
                  (!Array.isArray((selectedPhoto.issues as any)?._applied_actions) ||
                    (selectedPhoto.issues as any)._applied_actions.length <
                      selectedPhoto.issues._fix_actions.length) && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Manual-review suggestions
                      </h4>
                      <div className="space-y-1.5">
                        {selectedPhoto.issues._fix_actions.map(
                          (action: string, i: number) => (
                            <div
                              key={i}
                              className="flex gap-2 py-2 px-3 rounded-lg bg-blue-500/5 border border-blue-500/15"
                            >
                              <span className="text-blue-400 shrink-0">→</span>
                              <span className="text-xs text-blue-300 leading-relaxed">
                                {action}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Issues */}
                {selectedPhoto.issues &&
                  Object.keys(selectedPhoto.issues).filter(
                    (k) => !k.startsWith("_")
                  ).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Specific Issues
                      </h4>
                      <div className="space-y-1.5">
                        {Object.entries(selectedPhoto.issues)
                          .filter(([key]) => !key.startsWith("_"))
                          .map(([key, detail]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/15"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span className="text-xs text-red-300">
                                {issueLabels[key] ||
                                  key.replace(/_/g, " ")}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                {/* Fixes applied */}
                {selectedPhoto.fixesApplied?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      Auto-Fixes Applied
                    </h4>
                    <div className="space-y-1.5">
                      {selectedPhoto.fixesApplied.map((fix) => (
                        <div
                          key={fix}
                          className="flex items-center gap-2 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/15"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs text-amber-300">{fix}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Notes */}
                {selectedPhoto.aiNotes && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">AI Analysis</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-white/3 p-3 rounded-lg">
                      {selectedPhoto.aiNotes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {selectedPhoto.status === "FLAGGED" && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() =>
                        handlePhotoAction(selectedPhoto.id, "APPROVED")
                      }
                      className="flex-1 py-2.5 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        handlePhotoAction(selectedPhoto.id, "REJECTED")
                      }
                      className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DistractionSettings({
  propertyId,
  tier,
  initial,
  photos,
  onChanged,
}: {
  propertyId: string;
  tier: string;
  initial: string[];
  photos: any[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(initial || []);
  const [saving, setSaving] = useState(false);

  const enabled = tier === "PREMIUM";

  // Count distractions the detector found (Standard tier uses this for
  // the upsell nudge when the property is later upgraded).
  const detectedCount = photos.reduce((acc, p) => {
    return acc + ((p?.issues?.distractions_removed?.region_count as number) || 0);
  }, 0);

  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify([...(initial || [])].sort());

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distractionCategories: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to save categories");
        return;
      }
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={fadeUp} className="mb-5">
      {/* Gentle Standard-tier upsell when distractions would have been found */}
      {tier !== "PREMIUM" && detectedCount > 0 && (
        <div className="panel hairline-top p-3 mb-3 border-yellow-500/25 bg-yellow-500/5">
          <p className="text-xs text-yellow-200/90">
            <span className="font-mono text-yellow-300 mr-1">★</span>
            Upgrade this property to Premium to automatically remove{" "}
            <span className="font-mono stat-num font-semibold text-yellow-200">
              {detectedCount}
            </span>{" "}
            detected distraction{detectedCount !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
      >
        <span>
          Distraction Removal
          <span className="ml-2 text-muted-foreground/60">
            {selected.length} enabled
          </span>
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 panel hairline-top p-4 space-y-3">
          <DistractionCategoriesPanel
            value={selected}
            onChange={setSelected}
            disabled={saving}
            premiumOnly={!enabled}
            compact
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelected(initial || [])}
              disabled={saving || !dirty}
              className="text-[11px] px-3 py-1.5 rounded border border-border bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))] disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="text-[11px] px-3 py-1.5 rounded accent-bg hover:opacity-90 font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ExportButton({
  propertyId,
  propertyAddress,
  zipProgress,
  setZipProgress,
}: {
  propertyId: string;
  propertyAddress: string;
  zipProgress: any;
  setZipProgress: (p: any) => void;
}) {
  const [open, setOpen] = useState(false);

  const startExport = async (mode: "lightroom" | "full" | "mls" | "both") => {
    setOpen(false);
    try {
      await downloadPhotoZip(
        propertyId,
        propertyAddress,
        mode,
        (p) =>
          setZipProgress({
            phase: p.phase,
            done: p.done,
            total: p.total,
            current: p.currentFileName,
          })
      );
      setTimeout(() => setZipProgress(null), 2000);
    } catch (err: any) {
      alert("Export failed: " + (err?.message || "unknown error"));
      setZipProgress(null);
    }
  };

  const isBusy = zipProgress !== null && zipProgress.phase !== "done";

  return (
    <div className="relative">
      <button
        onClick={() => !isBusy && setOpen(!open)}
        disabled={isBusy}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30 text-blue-300 text-sm font-medium transition disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {zipProgress ? (
          <>
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            {zipProgress.phase === "fetching-xmp" && "Preparing..."}
            {zipProgress.phase === "downloading" &&
              `${zipProgress.done}/${zipProgress.total}`}
            {zipProgress.phase === "resizing" &&
              `Resizing ${zipProgress.done}/${zipProgress.total}`}
            {zipProgress.phase === "zipping" && `Zipping ${zipProgress.done}%`}
            {zipProgress.phase === "done" && "Done!"}
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>

      {open && !isBusy && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-80 glass-card p-2 z-50 shadow-2xl">
            <button
              onClick={() => startExport("full")}
              className="w-full p-3 rounded-xl hover:bg-white/5 transition text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-green-400" />
                <span className="font-medium text-sm">Full Size</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Original photos at full resolution. For client delivery or
                archiving.
              </p>
            </button>

            <button
              onClick={() => startExport("mls")}
              className="w-full p-3 rounded-xl hover:bg-white/5 transition text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-sm">MLS</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Max 2MB
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Resized to MLS spec (2048px long edge, &lt;2MB each). Ready to
                upload directly.
              </p>
            </button>

            <button
              onClick={() => startExport("both")}
              className="w-full p-3 rounded-xl hover:bg-white/5 transition text-left border-t border-white/5 mt-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-sm">Both</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Single ZIP containing /full and /mls folders. Full size for
                archive, MLS-ready for upload.
              </p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
