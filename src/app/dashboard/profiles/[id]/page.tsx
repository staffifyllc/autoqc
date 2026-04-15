"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  Upload,
  X,
  Sparkles,
  Palette,
  Thermometer,
  Sun,
  Contrast,
  Aperture,
  Ruler,
  Loader2,
  Check,
  Image as ImageIcon,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ReferencePhoto {
  key: string;
  url: string | null;
}

interface Profile {
  id: string;
  name: string;
  isDefault: boolean;
  colorTempAvg: number | null;
  colorTempMin: number | null;
  colorTempMax: number | null;
  saturationAvg: number | null;
  saturationMin: number | null;
  saturationMax: number | null;
  contrastAvg: number | null;
  exposureAvg: number | null;
  verticalTolerance: number;
  sharpnessThreshold: number;
  referencePhotos: string[];
  referencePhotosWithUrls?: ReferencePhoto[];
}

export default function ProfileDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [params.id]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profiles/${params.id}`);
      const data = await res.json();
      setProfile(data.profile);
      setName(data.profile?.name || "");
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true);
      setUploadProgress({ done: 0, total: accepted.length });
      setUploadError(null);

      try {
        const filesPayload = accepted.map((f) => ({
          name: f.name,
          type: f.type,
        }));
        const signRes = await fetch(
          `/api/profiles/${params.id}/upload-reference`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: filesPayload }),
          }
        );
        if (!signRes.ok) {
          throw new Error(
            `Could not get upload URLs (HTTP ${signRes.status})`
          );
        }
        const { uploads } = await signRes.json();

        // Upload each in parallel (4 concurrent). Track failures explicitly so
        // we can surface a clear error and not silently leave broken keys.
        const uploadedKeys: string[] = [];
        const failed: string[] = [];
        const queue = accepted.map((f, i) => ({ file: f, info: uploads[i] }));

        const putOnce = async (job: { file: File; info: any }) => {
          const res = await fetch(job.info.uploadUrl, {
            method: "PUT",
            body: job.file,
            headers: { "Content-Type": job.file.type },
          });
          if (!res.ok) throw new Error(`S3 PUT ${res.status}`);
        };

        const worker = async () => {
          while (queue.length > 0) {
            const job = queue.shift();
            if (!job) break;
            try {
              // 1 retry on transient failure
              try {
                await putOnce(job);
              } catch {
                await new Promise((r) => setTimeout(r, 400));
                await putOnce(job);
              }
              uploadedKeys.push(job.info.s3Key);
            } catch (err: any) {
              console.error(
                `Reference upload failed for ${job.file.name}:`,
                err?.message || err
              );
              failed.push(job.file.name);
            } finally {
              setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
            }
          }
        };

        await Promise.all([worker(), worker(), worker(), worker()]);

        if (uploadedKeys.length > 0) {
          // Save the keys that actually made it to S3
          const patchRes = await fetch(
            `/api/profiles/${params.id}/upload-reference`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ s3Keys: uploadedKeys }),
            }
          );
          if (!patchRes.ok) {
            throw new Error(`Could not save uploads (HTTP ${patchRes.status})`);
          }
        }

        if (failed.length > 0) {
          setUploadError(
            `${failed.length} of ${accepted.length} photos failed to upload. Check your network and try again.`
          );
        }

        await fetchProfile();
      } catch (err: any) {
        console.error("Upload error:", err);
        setUploadError(err?.message || "Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setUploadProgress({ done: 0, total: 0 });
      }
    },
    [params.id]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 50 * 1024 * 1024,
    disabled: uploading,
  });

  const removePhoto = async (key: string) => {
    if (!confirm("Remove this reference photo?")) return;
    await fetch(
      `/api/profiles/${params.id}/upload-reference?key=${encodeURIComponent(
        key
      )}`,
      { method: "DELETE" }
    );
    fetchProfile();
  };

  const saveName = async () => {
    if (!name.trim() || name === profile?.name) {
      setEditingName(false);
      return;
    }
    await fetch(`/api/profiles/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setEditingName(false);
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  const refPhotos = profile.referencePhotosWithUrls || [];
  const isLearned = profile.colorTempAvg !== null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <motion.div variants={fadeUp} className="mb-6">
        <Link
          href="/dashboard/profiles"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-3 font-mono uppercase tracking-wider"
        >
          <ArrowLeft className="w-3 h-3" />
          Style Profiles
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                className="text-2xl font-semibold tracking-tight bg-transparent border-b border-primary/40 outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-2xl font-semibold tracking-tight hover:text-primary transition text-left"
              >
                {profile.name}
              </button>
            )}
            <p className="text-xs text-muted-foreground font-mono mt-1.5 flex items-center gap-2">
              <span>
                {refPhotos.length} reference photo
                {refPhotos.length !== 1 ? "s" : ""}
              </span>
              {profile.isDefault && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-primary/15 text-primary">
                    Default
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Learned baseline params */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border mb-6"
      >
        {[
          {
            icon: Thermometer,
            label: "Color Temp",
            value: profile.colorTempAvg
              ? `${Math.round(profile.colorTempAvg)}K`
              : "--",
            range: profile.colorTempMin
              ? `${Math.round(profile.colorTempMin)} to ${Math.round(
                  profile.colorTempMax || 0
                )}K`
              : "not learned",
          },
          {
            icon: Sun,
            label: "Saturation",
            value: profile.saturationAvg
              ? `${Math.round(profile.saturationAvg)}%`
              : "--",
            range: profile.saturationMin
              ? `${Math.round(profile.saturationMin)} to ${Math.round(
                  profile.saturationMax || 0
                )}%`
              : "not learned",
          },
          {
            icon: Contrast,
            label: "Contrast",
            value: profile.contrastAvg
              ? Math.round(profile.contrastAvg).toString()
              : "--",
            range: "average",
          },
          {
            icon: Aperture,
            label: "Sharpness",
            value: profile.sharpnessThreshold.toFixed(0),
            range: "threshold",
          },
          {
            icon: Ruler,
            label: "Vertical Tol",
            value: `${profile.verticalTolerance.toFixed(1)}\u00B0`,
            range: "max deviation",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-[hsl(var(--surface-2))] p-4 hairline-top"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {m.label}
              </span>
              <m.icon className="w-3 h-3 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="font-mono stat-num text-xl font-semibold">
              {m.value}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">
              {m.range}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Upload zone */}
      <motion.div variants={fadeUp} className="panel hairline-top p-5 mb-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="font-medium text-sm">Reference Photos</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Upload 20 to 50 of your best, approved photos. AutoQC will
              analyze them to learn YOUR editing standard. Future QC checks
              use these as the baseline.
            </p>
          </div>
        </div>

        {uploadError && (
          <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200 flex items-start gap-2">
            <span className="font-mono uppercase tracking-wider text-[10px] mt-0.5">
              Error
            </span>
            <span className="flex-1">{uploadError}</span>
            <button
              onClick={() => setUploadError(null)}
              className="text-red-300/70 hover:text-red-200"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors duration-150 ${
            isDragActive
              ? "border-primary/60 bg-primary/[0.04]"
              : uploading
              ? "border-border bg-[hsl(var(--surface-1))] cursor-not-allowed"
              : "border-border hover:border-primary/30 hover:bg-[hsl(var(--surface-1))]"
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-brand-400 animate-spin" />
              <p className="font-medium">
                Uploading {uploadProgress.done} of {uploadProgress.total}{" "}
                photos...
              </p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">
                {isDragActive
                  ? "Drop reference photos here"
                  : "Drag and drop reference photos, or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                JPEG, PNG, WebP up to 50MB each
              </p>
            </>
          )}
        </div>
      </motion.div>

      {/* Reference photo grid */}
      {refPhotos.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {refPhotos.length} Reference Photo
              {refPhotos.length !== 1 ? "s" : ""}
            </h3>
            {refPhotos.length >= 10 && !isLearned && (
              <button
                onClick={async () => {
                  await fetch(`/api/profiles/${params.id}/learn`, {
                    method: "POST",
                  });
                  alert(
                    "Learning started! This may take a few minutes. Check back to see updated baseline parameters."
                  );
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Analyze & Learn Style
              </button>
            )}
            {isLearned && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <Check className="w-4 h-4" />
                Style learned
              </div>
            )}
          </div>

          <div className="grid grid-cols-6 gap-3">
            {refPhotos.map((photo) => (
              <div
                key={photo.key}
                className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-800 to-gray-900"
              >
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <button
                  onClick={() => removePhoto(photo.key)}
                  className="absolute top-1 right-1 p-1 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {refPhotos.length < 10 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Upload at least 10 photos before analyzing. 20-50 is ideal for
              accurate style learning.
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
