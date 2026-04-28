"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";

// Cinematic 3-stage scroll-driven transformation: raw -> AutoQC edited
// -> fully staged. Same room, scrolling forward.
//
// Stage A (top of section in view): RAW. Cool wash, slightly dim.
// Stage B (mid): AUTOQC EDITED. Crisp whites, warm wood, color
//   neutralized. (= the photo customers actually get back.)
// Stage C (bottom): VIRTUAL STAGED. Same architecture, now furnished.
//   (= what the $2 staging button lets them do on top.)
//
// Implementation: three absolutely-positioned <img> layers, opacity
// driven by scrollYProgress. Cheap, smooth, no shaders. A pinned
// caption strip up top calls out which stage you're looking at.

type Props = {
  rawSrc: string;
  editedSrc: string;
  stagedSrc: string;
};

export function ScrollStagingDemo({ rawSrc, editedSrc, stagedSrc }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Track scroll progress within this section. The section is tall on
  // purpose so the user has room to read each stage.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Animation windows are tightened to the FIRST 70% of scroll so the
  // last ~30% of the section is pure "linger time" — staged result
  // pinned in view long enough to actually take it in before the user
  // moves on. Section height is set to 320vh below to give that linger
  // ~96vh of pinned scroll.

  // === STAGE 1 → 2: photo gets fixed via a left-to-right scan wipe ===
  const editedClipRight = useTransform(
    scrollYProgress,
    [0.15, 0.38],
    [100, 0]
  );
  const editedSeamPct = useTransform(
    scrollYProgress,
    [0.15, 0.38],
    [0, 100]
  );
  const scanSeamOpacity = useTransform(
    scrollYProgress,
    [0.14, 0.18, 0.38, 0.42],
    [0, 1, 1, 0]
  );

  // === STAGE 2 → 3: furniture drops from the sky ===
  // Drop fully completes by 0.7 of scroll, leaving 0.7→1.0 (~30% of
  // the 320vh section, ~96vh) for the user to enjoy the finished
  // staging before the next section comes into view.
  const maskEdge = useTransform(
    scrollYProgress,
    [0.45, 0.7],
    [-10, 110]
  );
  const leadingEdgePct = useTransform(
    scrollYProgress,
    [0.45, 0.7],
    [-5, 100]
  );
  const stagedTranslateY = useTransform(
    scrollYProgress,
    [0.45, 0.65, 0.7],
    ["-2.5%", "1.0%", "0%"]
  );
  const stagedShadowOpacity = useTransform(
    scrollYProgress,
    [0.45, 0.68, 0.74],
    [0, 0.6, 0]
  );
  const settlePuffOpacity = useTransform(
    scrollYProgress,
    [0.66, 0.7, 0.76],
    [0, 0.55, 0]
  );
  const settlePuffScale = useTransform(
    scrollYProgress,
    [0.66, 0.76],
    [0.6, 1.4]
  );

  // Stage labels — raw, edited, staged. Staged label sticks visible
  // through the rest of the section (the "linger" window) so the
  // user always sees what they're looking at.
  const rawLabelOpacity = useTransform(
    scrollYProgress,
    [0.1, 0.22, 0.3],
    [1, 1, 0]
  );
  const editedLabelOpacity = useTransform(
    scrollYProgress,
    [0.26, 0.38, 0.5],
    [0, 1, 0]
  );
  const stagedLabelOpacity = useTransform(
    scrollYProgress,
    [0.46, 0.6, 1],
    [0, 1, 1]
  );

  // Tiny rotation jitter on the falling staged image
  const stagedRotate = useTransform(
    scrollYProgress,
    [0.45, 0.65, 0.7],
    [-0.6, 0.4, 0]
  );

  // CSS string templates — useMotionTemplate is required for non-
  // transform CSS props like clip-path and mask-image, otherwise the
  // motion value isn't subscribed by framer-motion's style updates.
  const editedClipPath = useMotionTemplate`inset(0 ${editedClipRight}% 0 0)`;
  const seamLeft = useMotionTemplate`${editedSeamPct}%`;
  // Mask edge clamped + offset for the feather band. We compute three
  // intermediate motion values so the gradient stops are well-formed.
  const maskTopStop = useTransform(maskEdge, (v) =>
    Math.max(0, Math.min(100, v - 7))
  );
  const maskBotStop = useTransform(maskEdge, (v) =>
    Math.max(0, Math.min(100, v + 7))
  );
  const maskGradient = useMotionTemplate`linear-gradient(180deg, black 0%, black ${maskTopStop}%, transparent ${maskBotStop}%, transparent 100%)`;
  const leadingEdgeAbove = useTransform(leadingEdgePct, (v: number) =>
    Math.max(0, v - 14)
  );
  const leadingEdgeAboveCss = useMotionTemplate`${leadingEdgeAbove}%`;

  return (
    <section
      ref={ref}
      className="relative py-24 px-6 border-t border-border"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-block mb-4 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] font-mono uppercase tracking-wider">
            Same room · scroll to see the full pipeline
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Edited.{" "}
            <span
              style={{
                background:
                  "linear-gradient(90deg, hsl(35 95% 65%) 0%, hsl(45 95% 75%) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Then staged.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            One scroll. AutoQC corrects the photo, then virtual staging drops
            in furniture. Architecture is preserved exactly the whole way
            through.
          </p>
        </motion.div>

        {/* Sticky frame — locks the photo in view as the user scrolls.
            Tall on purpose (320vh) so animations finish in the first
            ~70% and the last ~30% (~96vh) is pinned linger time on the
            completed staging. */}
        <div className="relative h-[320vh]">
          <div className="sticky top-[12vh] mx-auto max-w-5xl">
            <div className="relative aspect-[3/2] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-black">
              {/* Stage A — Raw (always the base layer) */}
              {/* eslint-disable @next/next/no-img-element */}
              <img
                src={rawSrc}
                alt="Raw upload"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Stage B — AutoQC edited, revealed left → right by a clip
                  that sweeps as the user scrolls. Looks like the QC
                  engine actively running across the photo. */}
              <motion.img
                src={editedSrc}
                alt="Same room, AutoQC edited"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  clipPath: editedClipPath,
                }}
              />
              {/* Glowing seam tracking the scan wipe */}
              <motion.div
                aria-hidden
                className="absolute inset-y-0 w-[3px] pointer-events-none"
                style={{
                  left: seamLeft,
                  opacity: scanSeamOpacity,
                  background:
                    "linear-gradient(180deg, transparent 0%, #55f19a 50%, transparent 100%)",
                  boxShadow: "0 0 26px 4px rgba(85,241,154,0.7)",
                  transform: "translateX(-1.5px)",
                }}
              />

              {/* Stage C — Virtual staged, drops in from the top. The
                  mask is a feathered linear gradient so the falling
                  edge looks like dust + light reveal, not a guillotine
                  line. Mask edge moves from below the frame up past
                  the top, with a 14% feather band straddling the
                  current edge. */}
              <motion.div
                className="absolute inset-0"
                style={{
                  maskImage: maskGradient,
                  WebkitMaskImage: maskGradient,
                }}
              >
                <motion.img
                  src={stagedSrc}
                  alt="Same room, virtually staged"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    y: stagedTranslateY,
                    rotate: stagedRotate,
                  }}
                />
              </motion.div>

              {/* Speed streaks — vertical light trails just above the
                  leading edge, suggesting the staging is being pulled
                  down through the air. Fade in/out with the drop. */}
              <SpeedStreaks
                progress={scrollYProgress}
                leadingEdgeCss={leadingEdgeAboveCss}
              />

              {/* Soft drop-shadow band under the falling content — sells
                  the "landed on the floor" moment. */}
              <motion.div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
                style={{
                  opacity: stagedShadowOpacity,
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)",
                }}
              />

              {/* Construction dust — many small particles fall from above
                  during stage 3, varied size/speed/x-position, white-ish
                  with low opacity. Sells the "drop from sky" with
                  physical debris. */}
              <ConstructionDust progress={scrollYProgress} />

              {/* Settle puff — quick dust cloud at the floor line right
                  when the drop completes. */}
              <motion.div
                aria-hidden
                className="absolute left-1/2 bottom-[8%] pointer-events-none"
                style={{
                  opacity: settlePuffOpacity,
                  scale: settlePuffScale,
                  width: "70%",
                  height: "20%",
                  translateX: "-50%",
                  background:
                    "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 35%, transparent 65%)",
                  filter: "blur(8px)",
                }}
              />

              {/* Stage label, pinned top-left over the photo */}
              <div className="absolute top-3 left-3 h-7 flex items-center pointer-events-none">
                <motion.div
                  className="absolute px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-mono uppercase tracking-wider text-white"
                  style={{ opacity: rawLabelOpacity }}
                >
                  Stage 1 · Raw upload
                </motion.div>
                <motion.div
                  className="absolute px-2.5 py-1 rounded-full bg-[#55f19a]/15 backdrop-blur-md border border-[#55f19a]/40 text-[10px] font-mono uppercase tracking-wider text-[#55f19a]"
                  style={{ opacity: editedLabelOpacity }}
                >
                  Stage 2 · AutoQC edited
                </motion.div>
                <motion.div
                  className="absolute px-2.5 py-1 rounded-full bg-amber-400/15 backdrop-blur-md border border-amber-400/40 text-[10px] font-mono uppercase tracking-wider text-amber-200"
                  style={{ opacity: stagedLabelOpacity }}
                >
                  Stage 3 · Virtually staged
                </motion.div>
              </div>

              {/* Persistent right-side meta */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-mono uppercase tracking-wider text-white/70">
                Architecture preserved
              </div>

              {/* Scroll progress bar at bottom */}
              <ScrollProgressBar progress={scrollYProgress} />
            </div>

            {/* Stage description strip */}
            <StageDescriptions
              rawOp={rawLabelOpacity}
              editedOp={editedLabelOpacity}
              stagedOp={stagedLabelOpacity}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Generate a deterministic dust spec list once at module scope so
// re-renders don't reshuffle the particles every frame.
type DustSpec = {
  x: number;          // 0..100
  size: number;       // px
  fireFrom: number;   // scrollYProgress to start
  fireTo: number;     // scrollYProgress to end at floor
  baseOpacity: number;
  drift: number;      // horizontal drift in % during fall
  blur: number;       // blur radius in px
};

function buildDust(count: number): DustSpec[] {
  // PRNG with fixed seed so the layout is stable across renders.
  let seed = 1729;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: count }).map(() => {
    // Match the tightened drop window (0.45..0.7). Particles spawn
    // staggered through 0.45..0.6 and finish hitting the floor by
    // ~0.74 so the puff + linger reads cleanly afterward.
    const fireFrom = 0.45 + rand() * 0.15;
    const fall = 0.08 + rand() * 0.12;
    return {
      x: rand() * 100,
      size: 1 + rand() * 4,
      fireFrom,
      fireTo: Math.min(0.78, fireFrom + fall),
      baseOpacity: 0.25 + rand() * 0.5,
      drift: (rand() - 0.5) * 14,
      blur: rand() < 0.4 ? 0.5 + rand() * 1.5 : 0,
    };
  });
}

const DUST = buildDust(38);

function ConstructionDust({ progress }: { progress: any }) {
  return (
    <>
      {DUST.map((d, i) => (
        <DustParticle key={i} spec={d} progress={progress} />
      ))}
    </>
  );
}

function DustParticle({
  spec,
  progress,
}: {
  spec: DustSpec;
  progress: any;
}) {
  // Each particle starts above the frame and lands ~85% down (above
  // the floor where furniture sits). White-ish, semi-transparent.
  const top = useTransform(
    progress,
    [spec.fireFrom, spec.fireTo],
    ["-8%", "85%"]
  );
  const left = useTransform(
    progress,
    [spec.fireFrom, spec.fireTo],
    [`${spec.x}%`, `${spec.x + spec.drift}%`]
  );
  const opacity = useTransform(
    progress,
    [spec.fireFrom - 0.005, spec.fireFrom + 0.02, spec.fireTo - 0.04, spec.fireTo + 0.01],
    [0, spec.baseOpacity, spec.baseOpacity * 0.6, 0]
  );
  return (
    <motion.div
      aria-hidden
      className="absolute rounded-full bg-white pointer-events-none"
      style={{
        width: spec.size,
        height: spec.size,
        top,
        left,
        opacity,
        filter: spec.blur ? `blur(${spec.blur}px)` : undefined,
        boxShadow:
          spec.size > 3
            ? "0 0 6px rgba(255,255,255,0.4)"
            : undefined,
      }}
    />
  );
}

// Speed streaks — vertical light trails just above the leading edge of
// the falling staging, suggesting motion. Streaks shorten + fade as the
// drop slows.
function SpeedStreaks({
  progress,
  leadingEdgeCss,
}: {
  progress: any;
  leadingEdgeCss: any;
}) {
  // Render 6 vertical streaks at fixed x positions. Each streak's `top`
  // tracks just above the leading edge so it travels with the drop.
  const xs = [12, 28, 44, 58, 74, 88];
  const streakOpacity = useTransform(
    progress,
    [0.55, 0.6, 0.78, 0.86],
    [0, 0.7, 0.4, 0]
  );
  const streakHeight = useTransform(
    progress,
    [0.55, 0.65, 0.85],
    ["8%", "14%", "0%"]
  );
  return (
    <>
      {xs.map((x, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: `${x}%`,
            top: leadingEdgeCss,
            width: "1px",
            height: streakHeight,
            opacity: streakOpacity,
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0.95) 100%)",
            transform: "translateX(-0.5px)",
          }}
        />
      ))}
    </>
  );
}

function ScrollProgressBar({ progress }: { progress: any }) {
  const width = useTransform(progress, [0.15, 0.95], ["0%", "100%"]);
  return (
    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-white/5">
      <motion.div
        className="h-full bg-gradient-to-r from-[#55f19a] via-[#8df7b9] to-amber-400"
        style={{ width }}
      />
    </div>
  );
}

function StageDescriptions({
  rawOp,
  editedOp,
  stagedOp,
}: {
  rawOp: any;
  editedOp: any;
  stagedOp: any;
}) {
  return (
    <div className="relative mt-8 h-16">
      <motion.div
        className="absolute inset-0 text-center"
        style={{ opacity: rawOp }}
      >
        <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Out-of-camera shot. Slight color cast on the walls, ceiling reads
          dim, wood floor a touch flat. This is what your editor would see
          first.
        </p>
      </motion.div>
      <motion.div
        className="absolute inset-0 text-center"
        style={{ opacity: editedOp }}
      >
        <p className="text-sm text-[#8df7b9] max-w-xl mx-auto leading-relaxed">
          AutoQC pass. Walls neutralized, wood floor warmed, verticals
          straightened, ceiling cleaned. 14 checks ran, 9 auto-fixes applied.
          $1 per photo.
        </p>
      </motion.div>
      <motion.div
        className="absolute inset-0 text-center"
        style={{ opacity: stagedOp }}
      >
        <p className="text-sm text-amber-200 max-w-xl mx-auto leading-relaxed">
          Virtual Staging dropped in. Same windows, same doorways, same wood
          floor, same chandelier. Furniture added in 15 seconds. $2 unlocks
          all six styles on this photo.
        </p>
      </motion.div>
    </div>
  );
}
