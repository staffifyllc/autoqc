"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Zap,
} from "lucide-react";

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadState {
  file: FileWithPreview;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  photoId?: string;
}

export function PhotoUploader({ propertyId }: { propertyId: string }) {
  const [files, setFiles] = useState<UploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map((file) => ({
      file: Object.assign(file, {
        preview: URL.createObjectURL(file),
      }),
      status: "pending" as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/tiff": [".tiff", ".tif"],
      "image/webp": [".webp"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      // Step 1: Get presigned URLs
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          files: files.map((f) => ({
            name: f.file.name,
            type: f.file.type,
            size: f.file.size,
          })),
        }),
      });

      const { uploads } = await res.json();

      // Step 2: Upload each file to S3 directly
      for (let i = 0; i < files.length; i++) {
        const upload = uploads[i];

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "uploading", progress: 0 } : f
          )
        );

        try {
          await fetch(upload.uploadUrl, {
            method: "PUT",
            body: files[i].file,
            headers: { "Content-Type": files[i].file.type },
          });

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: "uploaded",
                    progress: 100,
                    photoId: upload.photoId,
                  }
                : f
            )
          );
        } catch {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", progress: 0 } : f
            )
          );
        }
      }

      setUploadComplete(true);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunQC = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_qc" }),
      });

      if (res.status === 402) {
        // Payment required - redirect to credits page
        const data = await res.json();
        alert(data.message || "Payment required to process properties");
        window.location.href = "/dashboard/credits";
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to start QC");
        return;
      }

      window.location.href = `/dashboard/properties/${propertyId}`;
    } catch (err) {
      console.error("Failed to start QC:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      {!uploadComplete && (
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
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} photo{files.length !== 1 ? "s" : ""} selected
            </p>
            {!isUploading && !uploadComplete && (
              <button
                onClick={() => setFiles([])}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div
                  key={`${file.file.name}-${index}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10"
                >
                  {/* Thumbnail */}
                  {file.file.preview && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                      <img
                        src={file.file.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>

                  {/* Status */}
                  {file.status === "pending" && !isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 rounded-lg hover:bg-white/10 transition"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  {file.status === "uploading" && (
                    <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                  )}
                  {file.status === "uploaded" && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                  {file.status === "error" && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && !uploadComplete && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload {files.length} Photo{files.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}

      {uploadComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-400">
                All photos uploaded successfully
              </p>
              <p className="text-xs text-green-400/70 mt-0.5">
                {files.filter((f) => f.status === "uploaded").length} photos
                ready for QC
              </p>
            </div>
          </div>

          <button
            onClick={handleRunQC}
            className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition glow-sm flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Run Quality Check
          </button>
        </motion.div>
      )}
    </div>
  );
}
