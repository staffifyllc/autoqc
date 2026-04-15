"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload as UploadIcon,
  ExternalLink,
} from "lucide-react";
import { useUpload } from "@/lib/upload/UploadContext";

export function UploadStatusPanel() {
  const { jobs, dismissJob } = useUpload();
  const [minimized, setMinimized] = useState(false);

  const activeJobs = jobs.filter((j) => j.status !== "done");
  const doneJobs = jobs.filter((j) => j.status === "done");
  const allJobs = [...activeJobs, ...doneJobs];

  if (allJobs.length === 0) return null;

  // Calculate aggregate stats
  const totalFiles = allJobs.reduce((acc, j) => acc + j.files.length, 0);
  const uploadedFiles = allJobs.reduce(
    (acc, j) => acc + j.files.filter((f) => f.status === "uploaded").length,
    0
  );
  const anyActive = activeJobs.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-32px)]"
    >
      <div className="panel hairline-top overflow-hidden shadow-2xl shadow-black/60">
        {/* Header */}
        <button
          onClick={() => setMinimized(!minimized)}
          className="w-full px-3.5 py-3 flex items-center gap-3 hover:bg-[hsl(var(--surface-3))] transition-colors"
        >
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center ${
              anyActive
                ? "bg-primary/15 border border-primary/30"
                : "bg-emerald-500/15 border border-emerald-500/30"
            }`}
          >
            {anyActive ? (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-medium leading-tight">
              {anyActive ? "Uploading photos" : "Uploads complete"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {uploadedFiles} / {totalFiles} files · {allJobs.length} propert
              {allJobs.length === 1 ? "y" : "ies"}
            </p>
          </div>
          {minimized ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Jobs list */}
        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="border-t border-border"
            >
              <div className="max-h-96 overflow-y-auto p-2 space-y-2">
                {allJobs.map((job) => {
                  const done = job.files.filter(
                    (f) => f.status === "uploaded"
                  ).length;
                  const errored = job.files.filter(
                    (f) => f.status === "error"
                  ).length;
                  const progress = Math.round(
                    (done / job.files.length) * 100
                  );
                  const isDone = job.status === "done";

                  return (
                    <div
                      key={job.id}
                      className="p-3 rounded-md bg-[hsl(var(--surface-1))] border border-border space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/properties/${job.propertyId}`}
                          className="flex-1 min-w-0 flex items-center gap-1.5 hover:text-primary transition-colors"
                        >
                          <p className="text-[13px] font-medium truncate">
                            {job.propertyAddress}
                          </p>
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                        </Link>
                        {isDone && (
                          <button
                            onClick={() => dismissJob(job.id)}
                            className="p-1 rounded hover:bg-[hsl(var(--surface-3))] transition"
                            aria-label="Dismiss"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="h-1 rounded-full bg-[hsl(var(--surface-3))] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            errored > 0
                              ? "bg-amber-400"
                              : isDone
                              ? "bg-emerald-400"
                              : "bg-primary"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">
                          {done}/{job.files.length}
                          {errored > 0 && ` · ${errored} failed`}
                        </span>
                        <span
                          className={`font-semibold stat-num ${
                            errored > 0
                              ? "text-amber-300"
                              : isDone
                              ? "text-emerald-300"
                              : "text-primary"
                          }`}
                        >
                          {isDone
                            ? "DONE"
                            : job.status === "error"
                            ? "ERROR"
                            : `${progress}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
