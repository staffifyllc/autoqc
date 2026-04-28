"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

// Cinematic QC scan: as the user scrolls, a sample photo gets a green
// scan-line sweep. Behind the scan, virtual checks "land" on detected
// issues — verticals, color cast, exposure, etc. By the time the scan
// reaches the bottom, all 14 checks are pinged green.
//
// Pure scroll-driven. No autoplay loop. Reduced-motion users see a
// static labelled snapshot.

const CHECKS: Array<{ y: number; x: number; label: string }> = [
  { y: 0.08, x: 0.18, label: "Verticals · 0.4°" },
  { y: 0.14, x: 0.62, label: "Horizon · level" },
  { y: 0.22, x: 0.32, label: "Exposure · +0.2 EV" },
  { y: 0.28, x: 0.78, label: "White balance · 5400K" },
  { y: 0.36, x: 0.22, label: "Sharpness · 213" },
  { y: 0.42, x: 0.55, label: "No CA detected" },
  { y: 0.5, x: 0.18, label: "Sky · clean" },
  { y: 0.56, x: 0.7, label: "Composition · 91" },
  { y: 0.64, x: 0.4, label: "Room type · living_room" },
  { y: 0.7, x: 0.82, label: "Distractions · none" },
  { y: 0.78, x: 0.25, label: "Privacy · clear" },
  { y: 0.84, x: 0.6, label: "Lens distortion · ok" },
  { y: 0.9, x: 0.45, label: "HDR halos · none" },
  { y: 0.96, x: 0.78, label: "Cross-photo consistency · ok" },
];

export function QCScanScene({
  imageSrc,
}: {
  imageSrc: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Track scroll *within this section*. start "start end" = section top
  // hits viewport bottom; end "end start" = section bottom hits viewport
  // top. We map that 0→1 to the scan y position 0→1.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scanY = useTransform(scrollYProgress, [0.15, 0.85], ["0%", "100%"]);
  const overlayOpacity = useTransform(
    scrollYProgress,
    [0.05, 0.2, 0.8, 0.95],
    [0, 1, 1, 0]
  );

  return (
    <section
      ref={ref}
      className="relative py-32 px-6 border-t border-border overflow-hidden"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-block mb-4 px-3 py-1.5 rounded-full bg-[#55f19a]/10 border border-[#55f19a]/30 text-[#55f19a] text-[11px] font-mono uppercase tracking-wider">
            Live · 14 checks per photo
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Watch every pixel get{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg, #55f19a 0%, #8df7b9 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              audited.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Scroll. The scan runs verticals, horizon, color, exposure, sharpness,
            composition, distractions and ten more. Every result is logged on the
            photo before you ever open it.
          </p>
        </motion.div>

        <div
          className="relative aspect-[3/2] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
          data-cursor="scan"
        >
          {/* Base photo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt="Sample property photo being scanned by AutoQC"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Subtle dark wash so the scan UI reads against bright photos */}
          <motion.div
            className="absolute inset-0 bg-black/15 pointer-events-none"
            style={{ opacity: overlayOpacity }}
          />

          {/* Grid overlay — sci-fi targeting feel */}
          <motion.svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ opacity: overlayOpacity }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={(i + 1) * 10}
                y1="0"
                x2={(i + 1) * 10}
                y2="100"
                stroke="rgba(85,241,154,0.08)"
                strokeWidth="0.1"
              />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={(i + 1) * 10}
                x2="100"
                y2={(i + 1) * 10}
                stroke="rgba(85,241,154,0.08)"
                strokeWidth="0.1"
              />
            ))}
          </motion.svg>

          {/* The scan line itself */}
          <motion.div
            className="absolute inset-x-0 h-[2px] pointer-events-none"
            style={{
              top: scanY,
              background:
                "linear-gradient(180deg, transparent 0%, #55f19a 50%, transparent 100%)",
              boxShadow: "0 0 24px 4px rgba(85,241,154,0.55)",
              opacity: overlayOpacity,
            }}
          />

          {/* Trailing scan zone — soft green wash above the line */}
          <motion.div
            className="absolute inset-x-0 pointer-events-none"
            style={{
              top: 0,
              height: scanY,
              background:
                "linear-gradient(180deg, rgba(85,241,154,0.0) 0%, rgba(85,241,154,0.06) 80%, rgba(85,241,154,0.18) 100%)",
              opacity: overlayOpacity,
            }}
          />

          {/* Check pings — one per detected metric, each fires when the
              scan line passes its y position. */}
          {CHECKS.map((c) => (
            <ScanCheck key={c.label} progress={scrollYProgress} check={c} />
          ))}
        </div>

        {/* Counter strip */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#55f19a] mb-1">
              Total checks
            </div>
            <div className="text-2xl font-bold">14</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#55f19a] mb-1">
              Auto-fixes available
            </div>
            <div className="text-2xl font-bold">9</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#55f19a] mb-1">
              Time per property
            </div>
            <div className="text-2xl font-bold">~90s</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScanCheck({
  progress,
  check,
}: {
  progress: any;
  check: { x: number; y: number; label: string };
}) {
  // The scan line maps to scrollYProgress 0.15→0.85 across 0→100%.
  // A check at y=0.5 should ping when scrollYProgress ≈ 0.15 + 0.7*0.5 = 0.5.
  const fireProgress = 0.15 + 0.7 * check.y;
  const opacity = useTransform(
    progress,
    [fireProgress - 0.02, fireProgress + 0.02, 0.95],
    [0, 1, 1]
  );
  const scale = useTransform(
    progress,
    [fireProgress - 0.02, fireProgress + 0.02],
    [0.5, 1]
  );

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${check.x * 100}%`,
        top: `${check.y * 100}%`,
        transform: "translate(-50%, -50%)",
        opacity,
        scale,
      }}
    >
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0d1117]/85 border border-[#55f19a]/40 backdrop-blur-sm shadow-[0_0_20px_rgba(85,241,154,0.3)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#55f19a] shadow-[0_0_8px_rgba(85,241,154,0.9)]" />
        <span className="font-mono text-[10px] text-[#55f19a] whitespace-nowrap">
          {check.label}
        </span>
      </div>
    </motion.div>
  );
}
