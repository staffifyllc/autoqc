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
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Uploading in the background
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {uploaded} of {total} photos uploaded · You can navigate
              anywhere, it will keep going.
            </p>
          </div>
          <span className="text-sm font-bold text-brand-400">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full gradient-bg transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? "border-brand-400 bg-brand-500/10"
            : "border-white/15 hover:border-white/30 hover:bg-white/5"
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          <div
            className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center transition-colors ${
              isDragActive
                ? "bg-brand-500/20 border border-brand-500/30"
                : "bg-white/5 border border-white/10"
            }`}
          >
            <Upload
              className={`w-6 h-6 ${
                isDragActive ? "text-brand-400" : "text-muted-foreground"
              }`}
            />
          </div>
          <div>
            <p className="font-medium">
              {isDragActive
                ? "Drop photos here"
                : "Drag and drop photos, or click to browse"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              JPEG, PNG, TIFF, WebP up to 50MB each
            </p>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} photo{files.length !== 1 ? "s" : ""} ready to upload
            </p>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10"
                >
                  {file.preview && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                      <img
                        src={file.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 rounded-lg hover:bg-white/10 transition"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
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
          className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Start Background Upload ({files.length} photo
          {files.length !== 1 ? "s" : ""})
        </button>
      )}
    </div>
  );
}
