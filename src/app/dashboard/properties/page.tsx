"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Home,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  Send,
  ChevronRight,
  X,
  Image as ImageIcon,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ETA tuning. Derived from observed lambda telemetry: each photo takes
// about 25 seconds end to end (OpenCV + Claude Vision + occasional fix),
// and SQS/Lambda settles at ~4 concurrent invocations for the QC queue.
// Add a small buffer for finalization and cold start.
const SECONDS_PER_PHOTO = 25;
const PROCESSING_CONCURRENCY = 4;
const FINALIZATION_BUFFER_SECONDS = 15;

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.max(10, Math.round(seconds / 10) * 10)}s left`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `~${mins} min left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `~${hrs}h ${rem}m left` : `~${hrs}h left`;
}

type ProgressInfo =
  | { kind: "eta"; label: string; tone: string }
  | { kind: "action"; label: string; tone: string }
  | null;

function progressForProperty(property: any): ProgressInfo {
  const status = property.status;
  const remaining =
    typeof property.photosRemaining === "number"
      ? property.photosRemaining
      : property.photoCount ?? 0;

  // REVIEW: photos flagged, user needs to approve or reject.
  if (status === "REVIEW") {
    return {
      kind: "action",
      label: "Needs your review",
      tone: "text-amber-300",
    };
  }

  // PENDING with no photos yet: agent still uploading.
  if (status === "PENDING" && property.photoCount === 0) {
    return {
      kind: "action",
      label: "Upload photos to start",
      tone: "text-muted-foreground",
    };
  }

  // PROCESSING or PENDING with photos: compute ETA.
  if (status === "PROCESSING" || status === "PENDING") {
    // Stuck detection: updatedAt is older than 2x the expected ETA. Usually
    // means the lambda hit an unhandled error.
    const startedAt = property.updatedAt
      ? new Date(property.updatedAt).getTime()
      : null;
    const expectedSeconds =
      Math.ceil(Math.max(1, remaining) / PROCESSING_CONCURRENCY) *
        SECONDS_PER_PHOTO +
      FINALIZATION_BUFFER_SECONDS;
    if (
      startedAt &&
      Date.now() - startedAt > expectedSeconds * 1000 * 2 &&
      remaining > 0
    ) {
      return {
        kind: "action",
        label: "Stuck. Check logs or retry",
        tone: "text-red-300",
      };
    }

    if (remaining <= 0) {
      return { kind: "eta", label: "finalizing", tone: "text-muted-foreground" };
    }
    return {
      kind: "eta",
      label: formatEta(expectedSeconds),
      tone: "text-muted-foreground",
    };
  }

  return null;
}

const statusConfig: Record<
  string,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  PENDING: {
    label: "Pending",
    tone: "text-muted-foreground bg-[hsl(var(--surface-1))]",
    icon: Clock,
  },
  PROCESSING: {
    label: "Running",
    tone: "text-blue-300 bg-blue-500/10",
    icon: Zap,
  },
  REVIEW: {
    label: "Review",
    tone: "text-amber-300 bg-amber-500/10",
    icon: AlertTriangle,
  },
  APPROVED: {
    label: "Approved",
    tone: "text-emerald-300 bg-emerald-500/10",
    icon: CheckCircle2,
  },
  PUSHED: {
    label: "Delivered",
    tone: "text-violet-300 bg-violet-500/10",
    icon: Send,
  },
};

export default function PropertiesPage() {
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [address, setAddress] = useState("");
  const [tier, setTier] = useState<"STANDARD" | "PREMIUM">("STANDARD");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
    const interval = setInterval(fetchProperties, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-open new-property modal when ?new=true
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") setShowNewProperty(true);
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      setProperties(data.properties || []);
    } catch (err) {
      console.error("Failed to fetch properties:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProperty = async () => {
    if (!address.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, tier }),
      });
      const data = await res.json();
      window.location.href = `/dashboard/properties/${data.property.id}?upload=true`;
    } catch (err) {
      console.error("Failed to create property:", err);
      setCreating(false);
    }
  };

  const counts = {
    all: properties.length,
    in_progress: properties.filter(
      (p: any) => p.status === "PENDING" || p.status === "PROCESSING"
    ).length,
    review: properties.filter((p: any) => p.status === "REVIEW").length,
    approved: properties.filter((p: any) => p.status === "APPROVED").length,
    pushed: properties.filter((p: any) => p.status === "PUSHED").length,
  };

  const tabs: Array<{ key: string; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "in_progress", label: "In Progress", count: counts.in_progress },
    { key: "review", label: "Review", count: counts.review },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "pushed", label: "Delivered", count: counts.pushed },
  ];

  const filtered = properties
    .filter((p: any) => {
      if (statusFilter === "in_progress")
        return p.status === "PENDING" || p.status === "PROCESSING";
      if (statusFilter === "review") return p.status === "REVIEW";
      if (statusFilter === "approved") return p.status === "APPROVED";
      if (statusFilter === "pushed") return p.status === "PUSHED";
      return true;
    })
    .filter(
      (p: any) =>
        !searchQuery ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
    >
      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="flex items-end justify-between mb-6"
      >
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            Workspace · Properties
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Properties{" "}
            <span className="font-mono text-muted-foreground/60 text-base ml-1">
              {properties.length}
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowNewProperty(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          New Property
        </button>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        variants={fadeUp}
        className="mb-5 flex items-center gap-3 flex-wrap"
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-[hsl(var(--surface-2))] border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30 transition"
          />
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-md bg-[hsl(var(--surface-2))] border border-border">
          {tabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[hsl(var(--surface-3))] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}{" "}
                <span
                  className={`ml-1 font-mono text-[10px] ${
                    isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* List */}
      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <motion.div
          variants={fadeUp}
          className="panel hairline-top dot-pattern py-16 px-8 text-center"
        >
          <div className="w-12 h-12 rounded-lg border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center mx-auto mb-4">
            <Home className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium">
            {properties.length === 0
              ? "No properties yet"
              : "Nothing matches that filter"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            {properties.length === 0
              ? "Create your first property and upload photos to start running QC checks."
              : "Try changing the search or status filter above."}
          </p>
          {properties.length === 0 && (
            <button
              onClick={() => setShowNewProperty(true)}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              Create property
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={fadeUp}
          className="panel hairline-top divide-y divide-border overflow-hidden"
        >
          {filtered.map((property: any) => {
            const status =
              statusConfig[property.status] || statusConfig.PENDING;
            const StatusIcon = status.icon;
            const score =
              property.totalQcScore !== null &&
              property.totalQcScore !== undefined
                ? Math.round(property.totalQcScore)
                : null;

            return (
              <Link
                key={property.id}
                href={`/dashboard/properties/${property.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[hsl(var(--surface-3))] transition-colors group"
              >
                {/* Thumb / icon */}
                <div className="w-9 h-9 rounded-md border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Address + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {property.address}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {property.photoCount}
                    </span>
                    {property.client?.clientName && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="truncate">
                          {property.client.clientName}
                        </span>
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

                {/* Score */}
                {score !== null && (
                  <div className="text-right hidden md:block">
                    <span className="font-mono text-sm stat-num font-semibold">
                      {score}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">
                      /100
                    </span>
                  </div>
                )}

                {/* Progress / action indicator */}
                {(() => {
                  const info = progressForProperty(property);
                  if (!info) return null;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono whitespace-nowrap ${info.tone}`}
                    >
                      {info.kind === "action" && (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {info.label}
                    </span>
                  );
                })()}

                {/* Status pill */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${status.tone}`}
                >
                  <StatusIcon className="w-2.5 h-2.5" />
                  {status.label}
                </span>

                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground/80 transition" />
              </Link>
            );
          })}
        </motion.div>
      )}

      {/* New Property Modal */}
      <AnimatePresence>
        {showNewProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => {
                if (!creating) {
                  setShowNewProperty(false);
                  setAddress("");
                }
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative panel hairline-top w-full max-w-md p-6"
            >
              <button
                onClick={() => {
                  if (!creating) {
                    setShowNewProperty(false);
                    setAddress("");
                  }
                }}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-md hover:bg-[hsl(var(--surface-3))] transition"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Create
              </p>
              <h2 className="text-lg font-semibold">New Property</h2>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                Save the address now. Upload photos here or come back later.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Property Address
                  </label>
                  <input
                    type="text"
                    placeholder="123 Main St, City, State"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && address.trim() && !creating) {
                        handleCreateProperty();
                      }
                    }}
                    className="w-full px-3 py-2 rounded-md bg-[hsl(var(--surface-1))] border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30 transition"
                    autoFocus
                    disabled={creating}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Tier
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTier("STANDARD")}
                      disabled={creating}
                      className={`p-3 rounded-md text-left transition border ${
                        tier === "STANDARD"
                          ? "border-primary/60 bg-primary/5"
                          : "border-border bg-[hsl(var(--surface-1))] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">Standard</span>
                        <span className="text-[10px] font-mono text-primary">
                          1 cr
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Color correction, color temperature, verticals.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTier("PREMIUM")}
                      disabled={creating}
                      className={`p-3 rounded-md text-left transition border ${
                        tier === "PREMIUM"
                          ? "border-yellow-400/60 bg-yellow-500/5"
                          : "border-border bg-[hsl(var(--surface-1))] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <span className="text-yellow-300">★</span>
                          Premium
                        </span>
                        <span className="text-[10px] font-mono text-yellow-300">
                          2 cr
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Blur personal photos. Remove garbage cans, hoses,
                        toys, cables.
                      </p>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreateProperty}
                  disabled={!address.trim() || creating}
                  className="w-full py-2.5 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create {tier === "PREMIUM" ? "Premium" : "Standard"} Property
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SkeletonList() {
  return (
    <div className="panel hairline-top divide-y divide-border overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="w-9 h-9 rounded-md bg-[hsl(var(--surface-3))] animate-pulse-soft" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-[hsl(var(--surface-3))] animate-pulse-soft" />
            <div className="h-2 w-1/4 rounded bg-[hsl(var(--surface-3))] animate-pulse-soft" />
          </div>
          <div className="h-5 w-16 rounded-full bg-[hsl(var(--surface-3))] animate-pulse-soft" />
        </div>
      ))}
    </div>
  );
}
