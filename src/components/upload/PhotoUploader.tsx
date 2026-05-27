"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  X,
  Zap,
  ArrowRight,
  AlertCircle,
  Layers,
} from "lucide-react";
import { useUpload } from "@/lib/upload/UploadContext";
import {
  groupIntoBrackets,
  isRawFile,
  readBracketMetadata,
  type BracketGroup,
} from "@/lib/upload/bracketGrouping";

interface FileWithPreview extends File {
  preview?: string;
}

interface RejectionRecord {
  fileName: string;
  reason: string;
}

// Friendly explanations for the format rejections we see most often.
// HEIC is the iPhone default and was previously rejected silently.
function explainRejection(file: File, code: string): string {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (code === "file-too-large") {
    return `Over the 50MB cap. Try exporting at a lower JPEG quality.`;
  }
  if (code === "file-invalid-type") {
    if (["heic", "heif"].includes(ext)) {
      return `HEIC isn't supported yet. Open in Photos and export as JPEG, or set your iPhone camera to "Most Compatible".`;
    }
    if (["arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2"].includes(ext)) {
      return `RAW (.${ext}) isn't supported yet. Export as JPEG or TIFF first.`;
    }
    return `.${ext} isn't a supported format. Use JPEG, PNG, TIFF, or WebP.`;
  }
  return `Couldn't accept this file (${code}).`;
}

export function PhotoUploader({
  propertyId,
  propertyAddress = "this property",
  hdrEnabled = false,
  onComplete,
}: {
  propertyId: string;
  propertyAddress?: string;
  // When true the dropzone accepts RAW files and exposes the HDR
  // bracket-merge toggle. Driven by Agency.hdrMergeEnabled — flagged
  // on for Flylisted only.
  hdrEnabled?: boolean;
  onComplete?: () => void;
}) {
  const { startUpload, jobs } = useUpload();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  // hdrMode is the user-facing toggle. Defaults on whenever the
  // agency has HDR enabled; agents can flip it off for the rare
  // single-frame property without losing the option entirely.
  const [hdrMode, setHdrMode] = useState<boolean>(hdrEnabled);
  const [brackets, setBrackets] = useState<BracketGroup[] | null>(null);
  const [groupingBusy, setGroupingBusy] = useState(false);

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

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const newFiles = accepted.map((file) =>
        Object.assign(file, { preview: URL.createObjectURL(file) }),
      );
      setFiles((prev) => [...prev, ...newFiles]);
      // Surface why files were rejected. Previously we silently dropped
      // HEIC/RAW which made customers think their upload was working.
      if (rejected.length > 0) {
        const records: RejectionRecord[] = rejected.map((r) => ({
          fileName: r.file.name,
          reason: explainRejection(r.file, r.errors[0]?.code ?? "unknown"),
        }));
        setRejections((prev) => [...prev, ...records]);
      }
    },
    [],
  );

  const dismissRejection = (index: number) => {
    setRejections((prev) => prev.filter((_, i) => i !== index));
  };

  const clearRejections = () => setRejections([]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const acceptedFormats: Record<string, string[]> = hdrMode
    ? {
        // RAW formats for the HDR pipeline. Sony A7III/A7IV (.arw)
        // is the primary target; the others come for free since
        // rawpy handles them with no Lambda code change.
        "image/x-sony-arw": [".arw"],
        "image/x-canon-cr2": [".cr2"],
        "image/x-canon-cr3": [".cr3"],
        "image/x-nikon-nef": [".nef"],
        "image/x-adobe-dng": [".dng"],
        "image/x-fuji-raf": [".raf"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/tiff": [".tiff", ".tif"],
      }
    : {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/tiff": [".tiff", ".tif"],
        "image/webp": [".webp"],
      };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats,
    // RAW files routinely exceed 50MB (Sony A7IV uncompressed ARW is
    // ~50-80MB). Raise to 120MB for HDR mode and keep 50MB for the
    // standard JPEG flow.
    maxSize: (hdrMode ? 120 : 50) * 1024 * 1024,
    // react-dropzone v14 enables the File System Access API by default.
    // That breaks drag-and-drop silently in some Chrome configurations -
    // the customer drags photos in and nothing happens, only the click
    // -> file picker route works. Falling back to the classic input
    // listener makes drag-drop reliable across Chrome / Safari / Edge
    // / Firefox. Reported by TJ Romero at Architectural Storytelling.
    useFsAccessApi: false,
  });

  // Whenever the file set or mode changes, recompute bracket grouping
  // from EXIF so the agent sees "X scenes × N brackets" before kicking
  // off the upload. Cheap because exifr only pulls the small tag set
  // we need.
  useEffect(() => {
    if (!hdrMode || files.length === 0) {
      setBrackets(null);
      return;
    }
    let cancelled = false;
    setGroupingBusy(true);
    (async () => {
      const meta = await readBracketMetadata(files);
      if (cancelled) return;
      setBrackets(groupIntoBrackets(meta));
      setGroupingBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [files, hdrMode]);

  const startUploadJob = () => {
    if (files.length === 0) return;

    // HDR mode sends EVERY detected group through the API, including
    // singletons. The Lambda routes:
    //   len >= 2 → Mertens fuse
    //   len == 1 → rawpy decode (drone hero shots, dropped frames)
    // So no client-side filtering is needed; the server decides what
    // to do with each bracket set.
    let bracketPayload:
      | { sceneName: string; files: string[]; thumbnailFile: string }[]
      | undefined;

    if (hdrMode && brackets && brackets.length > 0) {
      bracketPayload = brackets.map((b) => ({
        sceneName: b.sceneName,
        files: b.files.map((f) => f.name),
        thumbnailFile: b.thumbnail.name,
      }));
    }

    const jobId = startUpload(
      propertyId,
      propertyAddress,
      files,
      bracketPayload
    );
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

  const bracketSceneCount = brackets?.filter((b) => b.files.length >= 2).length ?? 0;
  const bracketSingles = brackets?.filter((b) => b.files.length === 1).length ?? 0;

  return (
    <div className="space-y-5">
      {hdrEnabled && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-[hsl(var(--surface-1))] border border-border">
          <div
            className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 border ${
              hdrMode
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-[hsl(var(--surface-2))] border-border text-muted-foreground"
            }`}
          >
            <Layers className="w-4 h-4" strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium">HDR bracket merge</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {hdrMode
                ? "Drop RAW brackets. Scenes group automatically by EXIF capture time."
                : "Standard upload. Toggle on to upload RAW bracket sets."}
            </p>
          </div>
          <button
            onClick={() => setHdrMode((v) => !v)}
            role="switch"
            aria-checked={hdrMode}
            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
              hdrMode ? "bg-primary" : "bg-[hsl(var(--surface-3))]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                hdrMode ? "translate-x-4" : ""
              }`}
            />
          </button>
        </div>
      )}

      {hdrMode && files.length > 0 && (
        <div className="rounded-md border border-primary/25 bg-primary/[0.04] p-3 space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" strokeWidth={2} />
            {groupingBusy
              ? "Reading EXIF to group brackets..."
              : `${bracketSceneCount} scene${bracketSceneCount === 1 ? "" : "s"} detected`}
          </p>
          {!groupingBusy && brackets && (
            <p className="text-[12px] text-muted-foreground">
              {bracketSceneCount > 0 && (
                <>
                  {bracketSceneCount} bracket set
                  {bracketSceneCount === 1 ? "" : "s"} (avg{" "}
                  {(
                    brackets
                      .filter((b) => b.files.length >= 2)
                      .reduce((acc, b) => acc + b.files.length, 0) /
                      Math.max(1, bracketSceneCount)
                  ).toFixed(1)}{" "}
                  brackets each).
                </>
              )}
              {bracketSingles > 0 && (
                <>
                  {bracketSceneCount > 0 ? " " : ""}
                  {bracketSingles} single frame
                  {bracketSingles === 1 ? "" : "s"} will be RAW-decoded
                  individually and edited (no merge).
                </>
              )}
            </p>
          )}
        </div>
      )}

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
              {hdrMode
                ? "ARW · CR3 · NEF · DNG · JPEG · TIFF, up to 120MB each. Drop all brackets together."
                : "JPEG · PNG · TIFF · WebP, up to 50MB each. HEIC and RAW need to be exported first."}
            </p>
          </div>
        </div>
      </div>

      {/* Rejection feedback. Renders only when at least one file got
          dropped that we can't accept. Tells the user exactly which file
          and why (HEIC → export as JPEG, RAW → unsupported, etc.). */}
      {rejections.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
              {rejections.length} file{rejections.length !== 1 ? "s" : ""} not accepted
            </p>
            <button
              onClick={clearRejections}
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
            >
              Dismiss
            </button>
          </div>
          <ul className="space-y-1.5">
            {rejections.slice(0, 5).map((r, i) => (
              <li
                key={`${r.fileName}-${i}`}
                className="flex items-start gap-2 text-[12px]"
              >
                <span className="font-mono text-amber-200/90 truncate max-w-[180px] shrink-0">
                  {r.fileName}
                </span>
                <span className="text-muted-foreground flex-1">{r.reason}</span>
                <button
                  onClick={() => dismissRejection(i)}
                  className="p-0.5 rounded hover:bg-[hsl(var(--surface-3))] transition shrink-0"
                  aria-label={`Dismiss ${r.fileName}`}
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </li>
            ))}
            {rejections.length > 5 && (
              <li className="text-[11px] text-muted-foreground font-mono pl-1">
                ...and {rejections.length - 5} more.
              </li>
            )}
          </ul>
        </div>
      )}

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
