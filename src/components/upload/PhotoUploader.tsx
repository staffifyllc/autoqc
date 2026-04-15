"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  X,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useUpload } from "@/lib/upload/UploadContext";

interface FileWithPreview extends File {
  preview?: string;
}

export function PhotoUploader({
  propertyId,
  propertyAddress = "this property",
  onComplete,
}: {
  propertyId: string;
  propertyAddress?: string;
  onComplete?: () => void;
}) {
  const { startUpload, jobs } = useUpload();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Find this property's active job (if any)
  const activeJob = jobs.find(
    (j) => j.propertyId === propertyId && j.status !== "done"
  );

  // Watch for job completion
  useEffect(() => {
    if (!currentJobId) return;
    const job = jobs.find((j) => j.id === currentJobId);
    if (job && job.status === "done") {
      onComplete?.();
      setFiles([]);
      setCurrentJobId(null);
    }
  }, [jobs, currentJobId, onComplete]);

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map((file) =>
      Object.assign(file, { preview: URL.createObjectURL(file) })
    );
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/tiff": [".tiff", ".tif"],
      "image/webp": [".webp"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const startUploadJob = () => {
    if (files.length === 0) return;
    const jobId = startUpload(propertyId, propertyAddress, files);
    setCurrentJobId(jobId);
  };

  // Show the active upload status if one exists
  if (activeJob) {
    const uploaded = activeJob.files.filter(
      (f) => f.status === "uploaded"
    ).length;
    const total = activeJob.files.length;
    const progress = Math.round((uploaded / total) * 100);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-md bg-primary/[0.04] border border-primary/25">
          <div className="w-9 h-9 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4 text-primary" strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium">
              Uploading in the background
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {uploaded} / {total} uploaded. Navigate freely, it keeps going.
            </p>
          </div>
          <span className="text-sm font-mono stat-num font-semibold text-primary">
            {progress}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-[hsl(var(--surface-3))] overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors duration-150 ${
          isDragActive
            ? "border-primary/60 bg-primary/[0.04]"
            : "border-border hover:border-primary/30 hover:bg-[hsl(var(--surface-1))]"
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          <div
            className={`w-12 h-12 rounded-md mx-auto flex items-center justify-center transition-colors ${
              isDragActive
                ? "bg-primary/15 border border-primary/30"
                : "bg-[hsl(var(--surface-1))] border border-border"
            }`}
          >
            <Upload
              className={`w-5 h-5 ${
                isDragActive ? "text-primary" : "text-muted-foreground"
              }`}
              strokeWidth={1.75}
            />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragActive
                ? "Drop photos here"
                : "Drag and drop photos, or click to browse"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              JPEG · PNG · TIFF · WebP, up to 50MB each
            </p>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <span className="font-semibold text-foreground">
                {files.length}
              </span>{" "}
              photo{files.length !== 1 ? "s" : ""} queued
            </p>
            <button
              onClick={() => setFiles([])}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 p-2 rounded-md bg-[hsl(var(--surface-1))] border border-border"
                >
                  {file.preview && (
                    <div className="w-9 h-9 rounded overflow-hidden bg-[hsl(var(--surface-2))] shrink-0">
                      <img
                        src={file.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 rounded hover:bg-[hsl(var(--surface-3))] transition"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={startUploadJob}
          className="w-full py-2.5 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2 glow-sm"
        >
          <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
          Start background upload ({files.length} photo
          {files.length !== 1 ? "s" : ""})
        </button>
      )}
    </div>
  );
}
