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

  // Stage opacity curves. Each stage owns ~40% of the scroll, with
  // overlapping crossfades at the seams.
  const editedOpacity = useTransform(
    scrollYProgress,
    [0.2, 0.4, 0.55, 0.65],
    [0, 1, 1, 0]
  );
  const stagedOpacity = useTransform(
    scrollYProgress,
    [0.55, 0.7, 1, 1],
    [0, 1, 1, 1]
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

  // Subtle scale-up on the staged image to give the "drop in" feel.
  const stagedScale = useTransform(scrollYProgress, [0.55, 0.75], [1.04, 1]);

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
              {/* Stage A — Raw (always rendered, fades out as edited fades in) */}
              {/* eslint-disable @next/next/no-img-element */}
              <img
                src={rawSrc}
                alt="Raw upload"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Stage B — AutoQC edited */}
              <motion.img
                src={editedSrc}
                alt="Same room, AutoQC edited"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: editedOpacity }}
              />
              {/* Stage C — Virtual staged */}
              <motion.img
                src={stagedSrc}
                alt="Same room, virtually staged"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: stagedOpacity, scale: stagedScale }}
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
