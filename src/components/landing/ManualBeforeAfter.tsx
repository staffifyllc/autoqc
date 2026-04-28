"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Manual drag-to-compare slider. No shader, no auto-follow. Only updates
// on user drag (pointer down → move → up). Smooth, lightweight, doesn't
// burn frames on hover.
//
// Renders the after image as the base layer and clips the before image
// over the top from the left edge to the handle position. A visible
// vertical handle marks the seam and is the only interactive element.

type Props = {
  beforeSrc: string;
  afterSrc: string;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
  initial?: number; // 0..1, starting handle position. Defaults to 0.5.
};

export function ManualBeforeAfter({
  beforeSrc,
  afterSrc,
  className = "",
  beforeLabel = "Raw upload",
  afterLabel = "AutoQC output",
  initial = 0.5,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [hinted, setHinted] = useState(false);

  // Show the "drag me" hint pulse on the handle until the user has
  // actually dragged once. Persists for the session via sessionStorage.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("autoqc_slider_dragged") === "1") {
        setHinted(true);
      }
    } catch {}
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    setPos(Math.max(0, Math.min(1, x)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    setHinted(true);
    try {
      sessionStorage.setItem("autoqc_slider_dragged", "1");
    } catch {}
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // Keyboard support — arrows nudge the handle 2.5% per press.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setPos((p) => Math.max(0, p - 0.025));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setPos((p) => Math.min(1, p + 0.025));
    } else if (e.key === "Home") {
      setPos(0);
    } else if (e.key === "End") {
      setPos(1);
    }
  };

  const pct = pos * 100;

  return (
    <div
      ref={wrapRef}
      className={`relative select-none overflow-hidden ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: "none", cursor: dragging ? "grabbing" : "ew-resize" }}
    >
      {/* AFTER (base layer) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterSrc}
        alt={afterLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      {/* BEFORE (clipped) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={beforeLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      />

      {/* Corner labels */}
      <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-sm border border-white/10 text-[10px] font-mono uppercase tracking-wider text-white/85">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#55f19a]/15 backdrop-blur-sm border border-[#55f19a]/40 text-[10px] font-mono uppercase tracking-wider text-[#55f19a]">
        {afterLabel}
      </div>

      {/* Seam line */}
      <div
        aria-hidden
        className="absolute inset-y-0 w-px bg-[#55f19a]/80 shadow-[0_0_18px_rgba(85,241,154,0.55)] pointer-events-none"
        style={{ left: `${pct}%`, transform: "translateX(-0.5px)" }}
      />

      {/* Drag handle */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Drag to compare before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        onKeyDown={onKey}
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: `${pct}%`, transform: "translate(-50%, -50%)" }}
      >
        <div
          className={`relative w-12 h-12 rounded-full bg-[#55f19a] shadow-[0_0_24px_rgba(85,241,154,0.6)] flex items-center justify-center transition-transform ${
            dragging ? "scale-95" : "hover:scale-105"
          } ${!hinted ? "animate-handle-bob" : ""}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 text-black"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 3 12 9 6" />
            <polyline points="15 6 21 12 15 18" />
          </svg>
        </div>
        {!hinted && (
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 px-2 py-0.5 rounded bg-[#55f19a] text-black text-[10px] font-mono uppercase tracking-wider whitespace-nowrap pointer-events-none">
            drag
          </div>
        )}
      </div>
    </div>
  );
}
