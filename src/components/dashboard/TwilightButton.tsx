"use client";

import { useState } from "react";
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";

const ELIGIBLE_ROOM_TYPES = new Set([
  "exterior_front",
  "exterior_back",
  "exterior_pool",
]);

type Props = {
  photoId: string;
  fileName: string;
  roomType: string | null;
  hasTwilight: boolean;
  twilightUrl: string | null;
  onPurchased?: () => void;
};

export function TwilightButton({
  photoId,
  fileName,
  roomType,
  hasTwilight,
  twilightUrl,
  onPurchased,
}: Props) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(
    hasTwilight ? twilightUrl : null
  );

  // Only render for exterior photos.
  if (!roomType || !ELIGIBLE_ROOM_TYPES.has(roomType)) {
    return null;
  }

  const openAndPreview = async () => {
    setOpen(true);
    setError(null);
    if (previewUrl || finalUrl) return; // nothing to do
    setGenerating(true);
    try {
      const res = await fetch(`/api/photos/${photoId}/twilight/preview`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Preview failed");
      setPreviewUrl(data.url);
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
      const res = await fetch(`/api/photos/${photoId}/twilight/purchase`, {
        method: "POST",
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
      setPreviewUrl(null); // swap out watermarked preview for the clean final
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
  };

  const imgUrl = finalUrl || previewUrl;

  return (
    <>
      <button
        onClick={openAndPreview}
        className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 border ${
          finalUrl
            ? "bg-purple-500/10 border-purple-500/30 text-purple-200"
            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/20"
        }`}
      >
        <Sparkles className="w-3 h-3" />
        {finalUrl ? "Twilight purchased" : "Preview Twilight"}
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
                <Sparkles className="w-4 h-4 text-indigo-300" />
                <div>
                  <h2 className="font-semibold">Virtual Twilight</h2>
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

            <div className="flex-1 overflow-hidden bg-black relative flex items-center justify-center min-h-[320px]">
              {generating && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
                  <div className="text-sm">Generating twilight preview...</div>
                  <div className="text-xs">Usually 2-4 seconds.</div>
                </div>
              )}
              {!generating && imgUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt="Virtual Twilight"
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                  {!finalUrl && previewUrl && (
                    // Preview watermark — tiled diagonal "PREVIEW" overlay.
                    // Deterred screenshot-use without obscuring the eval.
                    <div
                      className="absolute inset-0 pointer-events-none flex items-center justify-center"
                      aria-hidden
                    >
                      <div className="text-white/15 text-6xl font-black tracking-widest uppercase -rotate-12 select-none">
                        Preview · AutoQC
                      </div>
                    </div>
                  )}
                </>
              )}
              {!generating && !imgUrl && !error && (
                <div className="text-sm text-muted-foreground">No preview</div>
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
                    Purchased and added to property exports.
                  </span>
                ) : (
                  "Previews are free. Keep the version you like for $1."
                )}
              </div>
              <div className="flex items-center gap-2">
                {finalUrl && (
                  <a
                    href={finalUrl}
                    download={`${fileName.replace(/\.[^.]+$/, "")}_twilight.jpg`}
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
                        <Sparkles className="w-3 h-3" />
                        Add for 1 credit ($1)
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
