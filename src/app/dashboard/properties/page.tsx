"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Home,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  Send,
  ChevronRight,
  X,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  PENDING: { label: "Pending", color: "text-gray-400", icon: Clock },
  PROCESSING: { label: "Processing", color: "text-blue-400", icon: Zap },
  REVIEW: {
    label: "Needs Review",
    color: "text-amber-400",
    icon: AlertTriangle,
  },
  APPROVED: { label: "Approved", color: "text-green-400", icon: CheckCircle2 },
  PUSHED: { label: "Delivered", color: "text-purple-400", icon: Send },
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
    // Auto-refresh every 5 seconds to show processing status changes
    const interval = setInterval(fetchProperties, 5000);
    return () => clearInterval(interval);
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
      // Navigate directly to the property detail page (persistent)
      // Upload happens there, progress is saved even if user navigates away
      window.location.href = `/dashboard/properties/${data.property.id}?upload=true`;
    } catch (err) {
      console.error("Failed to create property:", err);
      setCreating(false);
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
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your property photo shoots and QC results.
          </p>
        </div>
        <button
          onClick={() => setShowNewProperty(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-4 h-4" />
          New Property
        </button>
      </motion.div>

      {/* Search + Filter Tabs */}
      <motion.div variants={fadeUp} className="mb-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition"
          />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const counts = {
              all: properties.length,
              in_progress: properties.filter(
                (p: any) =>
                  p.status === "PENDING" || p.status === "PROCESSING"
              ).length,
              review: properties.filter((p: any) => p.status === "REVIEW")
                .length,
              approved: properties.filter(
                (p: any) => p.status === "APPROVED"
              ).length,
              pushed: properties.filter((p: any) => p.status === "PUSHED")
                .length,
            };
            const tabs = [
              { key: "all", label: `All (${counts.all})` },
              { key: "in_progress", label: `In Progress (${counts.in_progress})`, color: "text-blue-400" },
              { key: "review", label: `Review (${counts.review})`, color: "text-amber-400" },
              { key: "approved", label: `Approved (${counts.approved})`, color: "text-green-400" },
              { key: "pushed", label: `Delivered (${counts.pushed})`, color: "text-purple-400" },
            ];
            return tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  statusFilter === tab.key
                    ? "bg-white/10 text-foreground"
                    : `${tab.color || "text-muted-foreground"} hover:text-foreground hover:bg-white/5`
                }`}
              >
                {tab.label}
              </button>
            ));
          })()}
        </div>
      </motion.div>

      {/* Properties List */}
      {properties.length === 0 ? (
        <motion.div
          variants={fadeUp}
          className="glass-card p-12 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Home className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No properties yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Create your first property and upload photos to start running QC
            checks.
          </p>
          <button
            onClick={() => setShowNewProperty(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Create Property
          </button>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="space-y-3">
          {properties
            .filter((p: any) => {
              if (statusFilter === "in_progress") {
                return p.status === "PENDING" || p.status === "PROCESSING";
              } else if (statusFilter === "review") {
                return p.status === "REVIEW";
              } else if (statusFilter === "approved") {
                return p.status === "APPROVED";
              } else if (statusFilter === "pushed") {
                return p.status === "PUSHED";
              }
              return true;
            })
            .filter((p: any) =>
              !searchQuery ||
              p.address.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((property: any) => {
            const status = statusConfig[property.status] || statusConfig.PENDING;
            const StatusIcon = status.icon;

            return (
              <Link
                key={property.id}
                href={`/dashboard/properties/${property.id}`}
                className="glass-card-hover p-5 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Home className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{property.address}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {property.photoCount} photos
                    {property.client &&
                      ` for ${property.client.clientName}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {property.totalQcScore !== null && (
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {Math.round(property.totalQcScore)}
                      </p>
                      <p className="text-xs text-muted-foreground">QC Score</p>
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 ${status.color}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{status.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
                </div>
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                if (!creating) {
                  setShowNewProperty(false);
                  setAddress("");
                }
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative glass-card p-8 w-full max-w-md"
            >
              <button
                onClick={() => {
                  if (!creating) {
                    setShowNewProperty(false);
                    setAddress("");
                  }
                }}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-bold mb-1">New Property</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enter the address. We&apos;ll save it immediately so you can
                upload photos now or come back later.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
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
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition"
                    autoFocus
                    disabled={creating}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Tier
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTier("STANDARD")}
                      disabled={creating}
                      className={`p-3 rounded-xl text-left transition ${
                        tier === "STANDARD"
                          ? "bg-brand-500/15 border border-brand-500/40"
                          : "glass hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">Standard</span>
                        <span className="text-xs font-bold text-brand-400">
                          1 credit
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-tight">
                        9-category QC, auto-fix verticals + color. No privacy
                        blur.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTier("PREMIUM")}
                      disabled={creating}
                      className={`p-3 rounded-xl text-left transition relative ${
                        tier === "PREMIUM"
                          ? "bg-gradient-to-br from-yellow-500/20 to-amber-500/15 border border-yellow-500/40"
                          : "glass hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <span className="text-yellow-300">★</span> Premium
                        </span>
                        <span className="text-xs font-bold text-yellow-300">
                          2 credits
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-tight">
                        Everything in Standard + privacy blur (family photos,
                        kids, diplomas).
                      </p>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreateProperty}
                  disabled={!address.trim() || creating}
                  className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create{" "}
                      {tier === "PREMIUM" ? "Premium" : "Standard"} Property
                      <ChevronRight className="w-4 h-4" />
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
