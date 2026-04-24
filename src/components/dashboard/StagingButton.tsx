"use client";

import { useEffect, useState } from "react";
import {
  Sofa,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  ImagePlus,
  ImageIcon,
} from "lucide-react";
import {
  ELIGIBLE_STAGING_ROOM_TYPES,
  STAGING_STYLES,
  STAGING_CREDIT_COST,
  type StagingStyleId,
} from "@/lib/staging";

type Props = {
  photoId: string;
  fileName: string;
  roomType: string | null;
  onPurchased?: () => void;
};

export function StagingButton({
  photoId,
  fileName,
  roomType,
  onPurchased,
}: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<StagingStyleId>("modern");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Server decides the effective credit cost per agency (Flylisted gets
  // a discount, other partners can get overrides too). Default stays
  // STAGING_CREDIT_COST until the preview API tells us otherwise.
  const [creditCost, setCreditCost] = useState<number>(STAGING_CREDIT_COST);
  // Closed-beta gate. Same pattern the sidebar uses to hide admin nav.
  // While we validate render quality, only admin agencies see the button.
  const [eligible, setEligible] = useState<boolean | null>(null);
  // Optional inspiration image. When set, gets passed to OpenAI as a
  // second image[] entry and the prompt gains a "use this for style
  // cues only, not architecture" clause.
  const [inspirationKey, setInspirationKey] = useState<string | null>(null);
  const [inspirationPreview, setInspirationPreview] = useState<string | null>(null);
  const [uploadingInspiration, setUploadingInspiration] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/usage")
      .then((r) => {
        if (!cancelled) setEligible(r.status === 200);
      })
      .catch(() => {
        if (!cancelled) setEligible(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely for ineligible room types or non-admin users.
  if (!roomType || !ELIGIBLE_STAGING_ROOM_TYPES.has(roomType)) {
    return null;
  }
  if (eligible !== true) {
    return null;
  }

  const openPanel = () => {
    setOpen(true);
    setError(null);
  };

  const uploadInspiration = async (file: File) => {
    setUploadingInspiration(true);
    setError(null);
    try {
      const r1 = await fetch("/api/staging/inspiration-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1?.error ?? "Upload URL failed");
      const put = await fetch(d1.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      setInspirationKey(d1.s3Key);
      setInspirationPreview(URL.createObjectURL(file));
      // Throw away any existing preview - the inspiration changes the
      // output so the old preview is stale.
      setPreviewUrl(null);
      setFinalUrl(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingInspiration(false);
    }
  };

  const clearInspiration = () => {
    setInspirationKey(null);
    if (inspirationPreview) URL.revokeObjectURL(inspirationPreview);
    setInspirationPreview(null);
    setPreviewUrl(null);
    setFinalUrl(null);
  };

  const generate = async (s: StagingStyleId) => {
    setStyle(s);
    setGenerating(true);
    setError(null);
    setPreviewUrl(null);
    setFinalUrl(null);
    try {
      const res = await fetch(`/api/photos/${photoId}/staging/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: s,
          inspirationKey: inspirationKey ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Preview failed");
      setPreviewUrl(data.url);
      if (typeof data.creditCost === "number") setCreditCost(data.creditCost);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const purchase = async () => {
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/${photoId}/staging/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style,
          inspirationKey: inspirationKey ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          throw new Error(
            `Not enough credits. You have ${data.creditsAvailable}, need ${data.creditsNeeded}.`
          );
        }
        throw new Error(data?.error ?? "Purchase failed");
      }
      setFinalUrl(data.url);
      setPreviewUrl(null);
      onPurchased?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  const close = () => {
    setOpen(false);
    setError(null);
    setPreviewUrl(null);
    setFinalUrl(null);
  };

  const imgUrl = finalUrl || previewUrl;
  const currentStyle = STAGING_STYLES.find((s) => s.id === style)!;

  return (
    <>
      <button
        onClick={openPanel}
        className="text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 border bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
        title="Closed beta. Admin / invited agencies only."
      >
        <Sofa className="w-3 h-3" />
        Stage room
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-3xl bg-[hsl(var(--surface-1))] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sofa className="w-4 h-4 text-amber-300" />
                <div>
                  <h2 className="font-semibold">Virtual Staging</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fileName}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Style picker */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto">
              {STAGING_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => generate(s.id)}
                  disabled={generating || purchasing}
                  className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition ${
                    style === s.id
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-100"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  } disabled:opacity-50`}
                  title={s.description}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Inspiration upload */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
              {inspirationKey && inspirationPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inspirationPreview}
                    alt="Inspiration reference"
                    className="w-14 h-14 rounded-lg object-cover border border-amber-500/40"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-amber-200 flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3" />
                      Inspiration attached
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Style cues will be pulled from your reference image.
                    </div>
                  </div>
                  <button
                    onClick={clearInspiration}
                    disabled={generating || purchasing || uploadingInspiration}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-50"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <label
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-dashed border-white/20 hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer transition ${
                    uploadingInspiration ? "opacity-60 pointer-events-none" : ""
                  }`}
                  title="Upload a reference image to guide the furniture style"
                >
                  {uploadingInspiration ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {uploadingInspiration
                      ? "Uploading..."
                      : "Upload inspiration (optional)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={generating || purchasing || uploadingInspiration}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadInspiration(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex-1 overflow-hidden bg-black relative flex items-center justify-center min-h-[320px]">
              {generating && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
                  <div className="text-sm">
                    Staging in {currentStyle.label} style...
                  </div>
                  <div className="text-xs">Usually 3-6 seconds.</div>
                </div>
              )}
              {!generating && imgUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={`Virtual Staging: ${currentStyle.label}`}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                  {!finalUrl && previewUrl && (
                    <div
                      className="absolute inset-0 pointer-events-none flex items-center justify-center"
                      aria-hidden
                    >
                      <div className="text-white/30 text-6xl font-black tracking-widest uppercase -rotate-12 select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        Preview · AutoQC
                      </div>
                    </div>
                  )}
                </>
              )}
              {!generating && !imgUrl && !error && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground text-center px-6">
                  <Sofa className="w-8 h-8 opacity-40" />
                  <div className="text-sm">
                    Pick a style above to generate a preview.
                  </div>
                  <div className="text-xs">
                    Previews are free. Keep a render you like for {creditCost} credit{creditCost === 1 ? "" : "s"}.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="px-5 pt-3">
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {error}
                </div>
              </div>
            )}

            <div className="p-5 border-t border-white/10 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {finalUrl ? (
                  <span className="flex items-center gap-1.5 text-green-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Staged and added to property exports.
                  </span>
                ) : (
                  `Previews are free. Keep this render for ${creditCost} credit${creditCost === 1 ? "" : "s"} ($${creditCost}).`
                )}
              </div>
              <div className="flex items-center gap-2">
                {finalUrl && (
                  <a
                    href={finalUrl}
                    download={`${fileName.replace(/\.[^.]+$/, "")}_staged_${style}.jpg`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                )}
                {!finalUrl && (
                  <button
                    onClick={purchase}
                    disabled={generating || purchasing || !previewUrl}
                    className="text-xs px-4 py-1.5 rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Purchasing...
                      </>
                    ) : (
                      <>
                        <Sofa className="w-3 h-3" />
                        Keep for {creditCost} credit{creditCost === 1 ? "" : "s"}
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={close}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  {finalUrl ? "Done" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
