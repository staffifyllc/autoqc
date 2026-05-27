"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

interface HdrShoot {
  id: string;
  address: string;
  status: string;
  photoCount: number;
  photosDone: number;
  photosRemaining: number;
  createdAt: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const statusPill: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending upload", color: "text-muted-foreground" },
  PROCESSING: { label: "Merging + editing", color: "text-blue-300" },
  REVIEW: { label: "Needs review", color: "text-amber-300" },
  APPROVED: { label: "Ready to download", color: "text-green-300" },
  PUSHED: { label: "Delivered", color: "text-green-400" },
};

export default function HdrIndexPage() {
  const [shoots, setShoots] = useState<HdrShoot[] | null>(null);

  useEffect(() => {
    fetch("/api/properties?filter=hdr")
      .then((r) => r.json())
      .then((d) => setShoots(d.properties ?? []))
      .catch(() => setShoots([]));
  }, []);

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-primary" strokeWidth={2.25} />
            Auto-Edit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload Sony ARW brackets. We fuse them with Mertens exposure
            fusion and apply the Flylisted look automatically.
          </p>
        </div>
        <Link
          href="/dashboard/hdr/new"
          className="flex items-center gap-2 px-3 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New shoot
        </Link>
      </div>

      {shoots === null && (
        <div className="panel hairline-top p-8 text-center text-sm text-muted-foreground">
          Loading shoots...
        </div>
      )}

      {shoots && shoots.length === 0 && (
        <div className="panel hairline-top p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-medium">No HDR shoots yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a shoot, drop your bracket sets, and we handle the
              merge + edit end to end.
            </p>
          </div>
          <Link
            href="/dashboard/hdr/new"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Start your first shoot
          </Link>
        </div>
      )}

      {shoots && shoots.length > 0 && (
        <div className="space-y-2">
          {shoots.map((s) => {
            const pill = statusPill[s.status] ?? {
              label: s.status,
              color: "text-muted-foreground",
            };
            const total = s.photoCount;
            const done = s.photosDone ?? 0;
            const pct =
              total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            const isProcessing = s.status === "PROCESSING";
            const isReview = s.status === "REVIEW";
            const isDone = s.status === "APPROVED" || s.status === "PUSHED";

            return (
              <Link
                key={s.id}
                href={`/dashboard/properties/${s.id}`}
                className="block panel hairline-top p-4 hover:border-primary/30 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-[hsl(var(--surface-1))] border border-border flex items-center justify-center shrink-0">
                    {isProcessing ? (
                      <Clock
                        className="w-4 h-4 text-blue-300"
                        strokeWidth={2}
                      />
                    ) : isReview ? (
                      <AlertTriangle
                        className="w-4 h-4 text-amber-300"
                        strokeWidth={2}
                      />
                    ) : isDone ? (
                      <CheckCircle2
                        className="w-4 h-4 text-green-300"
                        strokeWidth={2}
                      />
                    ) : (
                      <Layers
                        className="w-4 h-4 text-muted-foreground"
                        strokeWidth={2}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.address}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[11px] font-mono uppercase tracking-wider ${pill.color}`}
                      >
                        {pill.label}
                      </span>
                      {total > 0 && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          · {done}/{total} scenes
                        </span>
                      )}
                    </div>
                  </div>

                  {isProcessing && total > 0 && (
                    <div className="w-20 h-1 rounded-full bg-[hsl(var(--surface-3))] overflow-hidden shrink-0">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <ChevronRight
                    className="w-4 h-4 text-muted-foreground shrink-0"
                    strokeWidth={2}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
