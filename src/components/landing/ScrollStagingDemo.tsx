"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

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

  // === STAGE 1 → 2: photo gets fixed via a left-to-right scan wipe ===
  // The edited image is revealed behind a clip-path that sweeps from left
  // to right. A glowing green seam line tracks the wipe edge so the
  // motion reads as "AutoQC actively running over the photo".
  // editedClipRight: percentage of the image that's STILL CLIPPED on the
  // right side. 100 = nothing visible, 0 = fully visible.
  const editedClipRight = useTransform(
    scrollYProgress,
    [0.2, 0.5],
    [100, 0]
  );
  const editedSeamPct = useTransform(
    scrollYProgress,
    [0.2, 0.5],
    [0, 100]
  );
  const scanSeamOpacity = useTransform(
    scrollYProgress,
    [0.18, 0.22, 0.5, 0.55],
    [0, 1, 1, 0]
  );

  // === STAGE 2 → 3: furniture drops from the sky ===
  // Staged image is clipped from the top, revealing top-down. Plus a
  // subtle translateY → 0 with a small overshoot for "thud" landing.
  const stagedClipTop = useTransform(
    scrollYProgress,
    [0.55, 0.85],
    [100, 0]
  );
  const stagedTranslateY = useTransform(
    scrollYProgress,
    [0.55, 0.82, 0.88],
    ["-3%", "1.2%", "0%"]
  );
  // Soft drop shadow under the falling layer to anchor it visually.
  const stagedShadowOpacity = useTransform(
    scrollYProgress,
    [0.55, 0.85, 0.92],
    [0, 0.6, 0]
  );

  // Stage label (one of three) — fades to whichever stage is most
  // visible. We render all three labels stacked and let opacity pick.
  const rawLabelOpacity = useTransform(
    scrollYProgress,
    [0.15, 0.3, 0.4],
    [1, 1, 0]
  );
  const editedLabelOpacity = useTransform(
    scrollYProgress,
    [0.35, 0.5, 0.65],
    [0, 1, 0]
  );
  const stagedLabelOpacity = useTransform(
    scrollYProgress,
    [0.6, 0.75, 0.9],
    [0, 1, 1]
  );

  // Tiny rotation jitter on the falling staged image — adds physicality
  // to the drop without distracting.
  const stagedRotate = useTransform(
    scrollYProgress,
    [0.55, 0.82, 0.88],
    [-0.6, 0.4, 0]
  );

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

        {/* Sticky frame — locks the photo in view as the user scrolls and
            lets the stages crossfade in place. */}
        <div className="relative h-[200vh]">
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
                  clipPath: useTransform(
                    editedClipRight,
                    (v: number) => `inset(0 ${v}% 0 0)`
                  ),
                }}
              />
              {/* Glowing seam tracking the scan wipe */}
              <motion.div
                aria-hidden
                className="absolute inset-y-0 w-[3px] pointer-events-none"
                style={{
                  left: useTransform(editedSeamPct, (v: number) => `${v}%`),
                  opacity: scanSeamOpacity,
                  background:
                    "linear-gradient(180deg, transparent 0%, #55f19a 50%, transparent 100%)",
                  boxShadow: "0 0 26px 4px rgba(85,241,154,0.7)",
                  transform: "translateX(-1.5px)",
                }}
              />

              {/* Stage C — Virtual staged, drops in from the top. Clip
                  starts at top:100% (fully clipped from above, invisible)
                  and animates to 0% (fully revealed). Translate + tiny
                  rotation give the falling/thud feel. */}
              <motion.div
                className="absolute inset-0"
                style={{
                  clipPath: useTransform(
                    stagedClipTop,
                    (v: number) => `inset(${v}% 0 0 0)`
                  ),
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

              {/* Falling-pixel particle hint at the start of stage 3 —
                  five tiny green dots that drop with stagger when the
                  furniture starts coming in. */}
              <FallingDots progress={scrollYProgress} />

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

function FallingDots({ progress }: { progress: any }) {
  // Five amber dots, each starts above the frame and drops to its
  // landing position over a slightly different scroll window. Adds
  // physicality to the "furniture dropping from sky" moment.
  const dots = [
    { x: 18, land: 62, fireFrom: 0.56, fireTo: 0.7 },
    { x: 36, land: 58, fireFrom: 0.58, fireTo: 0.72 },
    { x: 50, land: 64, fireFrom: 0.6, fireTo: 0.74 },
    { x: 66, land: 60, fireFrom: 0.62, fireTo: 0.76 },
    { x: 82, land: 66, fireFrom: 0.64, fireTo: 0.78 },
  ];
  return (
    <>
      {dots.map((d, i) => {
        const y = useTransform(
          progress,
          [d.fireFrom, d.fireTo],
          ["-15%", `${d.land}%`]
        );
        const opacity = useTransform(
          progress,
          [d.fireFrom - 0.01, d.fireFrom + 0.02, d.fireTo, d.fireTo + 0.04],
          [0, 1, 1, 0]
        );
        return (
          <motion.div
            key={i}
            aria-hidden
            className="absolute w-1.5 h-1.5 rounded-full bg-[#55f19a] shadow-[0_0_10px_rgba(85,241,154,0.9)] pointer-events-none"
            style={{
              left: `${d.x}%`,
              top: y,
              opacity,
            }}
          />
        );
      })}
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
