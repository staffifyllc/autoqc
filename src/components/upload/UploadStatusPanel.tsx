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
      <div className="glass-card overflow-hidden shadow-2xl shadow-black/40">
        {/* Header */}
        <button
          onClick={() => setMinimized(!minimized)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              anyActive
                ? "bg-brand-500/20 border border-brand-500/30"
                : "bg-green-500/20 border border-green-500/30"
            }`}
          >
            {anyActive ? (
              <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium">
              {anyActive
                ? `Uploading ${uploadedFiles}/${totalFiles} photos`
                : `Uploaded ${uploadedFiles} photos`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {allJobs.length} propert{allJobs.length === 1 ? "y" : "ies"}
            </p>
          </div>
          {minimized ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
                      className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/properties/${job.propertyId}`}
                          className="flex-1 min-w-0 flex items-center gap-1.5 hover:underline"
                        >
                          <p className="text-sm font-medium truncate">
                            {job.propertyAddress}
                          </p>
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                        </Link>
                        {isDone && (
                          <button
                            onClick={() => dismissJob(job.id)}
                            className="p-1 rounded hover:bg-white/10 transition"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            errored > 0
                              ? "bg-amber-400"
                              : isDone
                              ? "bg-green-400"
                              : "gradient-bg"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {done}/{job.files.length} uploaded
                          {errored > 0 && ` · ${errored} failed`}
                        </span>
                        <span
                          className={`font-medium ${
                            errored > 0
                              ? "text-amber-400"
                              : isDone
                              ? "text-green-400"
                              : "text-brand-400"
                          }`}
                        >
                          {isDone
                            ? "Done"
                            : job.status === "error"
                            ? "Error"
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
