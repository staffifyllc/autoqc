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
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
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
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-8">
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Properties
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{property.address}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {property.photos.length} photos
              {property.client && ` for ${property.client.clientName}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!showUploader && (
              <button
                onClick={() => setShowUploader(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass hover:bg-white/10 text-sm font-medium transition"
              >
                <Upload className="w-4 h-4" />
                {property.photos.length === 0 ? "Upload Photos" : "Add More Photos"}
              </button>
            )}
            {property.status === "APPROVED" && (
              <button
                onClick={() => handlePush("ARYEO")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
              >
                <Send className="w-4 h-4" />
                Push to Platform
              </button>
            )}
            {property.photos.length > 0 && property.status !== "PENDING" && (
              <button
                onClick={() => {
                  fetch(`/api/properties/${params.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "run_qc" }),
                  }).then(fetchProperty);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass hover:bg-white/10 text-sm font-medium transition"
              >
                <RotateCcw className="w-4 h-4" />
                Re-run QC
              </button>
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
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

      {/* Summary Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold">
            {property.totalQcScore !== null
              ? Math.round(property.totalQcScore)
              : "--"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">QC Score</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{passCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Passed</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{fixedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Auto-Fixed</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{flaggedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Flagged</p>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
        {[
          { key: "all", label: `All (${property.photos.length})` },
          { key: "passed", label: `Passed (${passCount})` },
          { key: "issues", label: `Issues (${fixedCount + flaggedCount})` },
          { key: "flagged", label: `Flagged (${flaggedCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === tab.key
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Photo Grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-4">
        {filteredPhotos?.map((photo: Photo) => {
          const status = statusConfig[photo.status] || statusConfig.PENDING;
          const hasIssues =
            photo.issues && Object.keys(photo.issues).length > 0;

          return (
            <motion.button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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

              {/* Status badge */}
              <div
                className={`absolute top-2 right-2 px-2 py-1 rounded-lg ${status.bg} ${status.color} text-xs font-medium backdrop-blur-sm`}
              >
                {status.label}
              </div>

              {/* QC score */}
              {photo.qcScore !== null && (
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-xs font-bold">
                  {Math.round(photo.qcScore)}
                </div>
              )}

              {/* Issue count */}
              {hasIssues && (
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium backdrop-blur-sm">
                  {Object.keys(photo.issues!).length} issues
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.button>
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

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="relative flex w-full max-w-6xl mx-auto my-8"
            >
              {/* Image area */}
              <div className="flex-1 flex items-center justify-center p-8">
                {selectedPhoto.fixedUrl && selectedPhoto.originalUrl ? (
                  <div className="w-full max-h-full rounded-xl overflow-hidden">
                    <ReactCompareSlider
                      itemOne={
                        <ReactCompareSliderImage
                          src={selectedPhoto.originalUrl}
                          alt="Original"
                        />
                      }
                      itemTwo={
                        <ReactCompareSliderImage
                          src={selectedPhoto.fixedUrl}
                          alt="Fixed"
                        />
                      }
                      className="rounded-xl"
                    />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>Original</span>
                      <span>Auto-Fixed</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <span className="text-muted-foreground">
                      {selectedPhoto.fileName}
                    </span>
                  </div>
                )}
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

                {/* Issues */}
                {selectedPhoto.issues &&
                  Object.keys(selectedPhoto.issues).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">Issues Found</h4>
                      <div className="space-y-1.5">
                        {Object.entries(selectedPhoto.issues).map(
                          ([key, detail]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/15"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span className="text-xs text-red-300">
                                {issueLabels[key] || key}
                              </span>
                            </div>
                          )
                        )}
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
