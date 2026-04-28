"use client";

import { useEffect, useRef, useState } from "react";

// Lusion-style cursor: a target reticle that follows the pointer and
// transforms based on what it's hovering. Over photos / sliders it
// reads as "the AI is scanning every pixel" — over buttons it grows
// into a soft pill that hugs the action.
//
// Hidden on touch devices and reduced-motion users.

const HOVER_SELECTOR =
  "a, button, [role='button'], [data-cursor='hover'], .cursor-hover";
const SCAN_SELECTOR =
  "[data-cursor='scan']";

export function CursorReticle() {
  const root = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: -100, y: -100 });
  const current = useRef({ x: -100, y: -100 });
  const raf = useRef<number | null>(null);
  const [mode, setMode] = useState<"idle" | "hover" | "scan">("idle");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supportsHover = window.matchMedia("(hover: hover)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!supportsHover || reducedMotion) return;
    setEnabled(true);
    document.body.style.cursor = "none";

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest(SCAN_SELECTOR)) setMode("scan");
      else if (t.closest(HOVER_SELECTOR)) setMode("hover");
      else setMode("idle");
    };

    const tick = () => {
      const ease = 0.18;
      current.current.x += (target.current.x - current.current.x) * ease;
      current.current.y += (target.current.y - current.current.y) * ease;
      if (root.current) {
        root.current.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0)`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      if (raf.current) cancelAnimationFrame(raf.current);
      document.body.style.cursor = "";
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[9999] mix-blend-difference"
      style={{ willChange: "transform" }}
    >
      <div
        ref={inner}
        className={`relative -translate-x-1/2 -translate-y-1/2 transition-[width,height,border-radius,border-width] duration-200 ease-out ${
          mode === "hover"
            ? "w-12 h-12 rounded-full border-2 border-[#55f19a] bg-transparent"
            : mode === "scan"
              ? "w-16 h-16 rounded-md border border-[#55f19a]"
              : "w-5 h-5 rounded-full border border-white/80 bg-transparent"
        }`}
      >
        {mode === "scan" && (
          <>
            {/* Corner brackets — sci-fi viewfinder feel */}
            <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#55f19a]" />
            <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#55f19a]" />
            <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#55f19a]" />
            <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#55f19a]" />
            {/* Vertical scan-line sweep */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#55f19a] to-transparent animate-cursor-scan" />
            {/* Center dot */}
            <span className="absolute top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#55f19a]" />
          </>
        )}
        {mode === "idle" && (
          <span className="absolute top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
        )}
      </div>
    </div>
  );
}
