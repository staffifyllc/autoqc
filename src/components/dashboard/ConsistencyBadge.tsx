"use client";

import { useMemo, useState } from "react";
import { Layers, ChevronDown, AlertTriangle, CheckCircle2 } from "lucide-react";

// Cross-shoot consistency report card.
//
// Reads `colorTemp`, `exposure`, `saturation` directly off each photo
// row (already populated by the QC engine) and computes deviation
// from the set median. Mirrors the thresholds used in
// lambda/qc_engine/checks/consistency.py:
//   color_temp variance from median > 300K  -> drift
//   exposure variance from median > 1.5 EV  -> drift
//   saturation variance from median > 20    -> drift
//
// Reports a single 0-100 score plus per-axis variance, and a
// per-photo drifter list when expanded. Surfaces what photographers
// say is the #1 trust killer for AI-edited shoots: cross-frame drift.

interface PhotoMetrics {
  id: string;
  fileName: string;
  colorTemp: number | null;
  exposure: number | null;
  saturation: number | null;
}

interface DrifterReason {
  fileName: string;
  axes: string[];
}

const COLOR_TEMP_THRESHOLD = 300; // Kelvin from median
const EXPOSURE_THRESHOLD = 1.5;   // EV from median
const SATURATION_THRESHOLD = 20;  // 0-100 scale from median

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function ConsistencyBadge({ photos }: { photos: PhotoMetrics[] }) {
  const [open, setOpen] = useState(false);

  const data = useMemo(() => {
    const filtered = photos.filter(
      (p) =>
        p.colorTemp != null || p.exposure != null || p.saturation != null,
    );
    if (filtered.length < 2) return null;

    const colorTemps = filtered
      .map((p) => p.colorTemp)
      .filter((v): v is number => v != null);
    const exposures = filtered
      .map((p) => p.exposure)
      .filter((v): v is number => v != null);
    const sats = filtered
      .map((p) => p.saturation)
      .filter((v): v is number => v != null);

    const tempMedian = colorTemps.length >= 2 ? median(colorTemps) : null;
    const expMedian = exposures.length >= 2 ? median(exposures) : null;
    const satMedian = sats.length >= 2 ? median(sats) : null;

    const tempRange =
      colorTemps.length >= 2
        ? Math.max(...colorTemps) - Math.min(...colorTemps)
        : 0;
    const expRange =
      exposures.length >= 2
        ? Math.max(...exposures) - Math.min(...exposures)
        : 0;
    const satRange =
      sats.length >= 2 ? Math.max(...sats) - Math.min(...sats) : 0;

    // Per-photo drift: any axis where this photo deviates from median
    // beyond threshold. We list each affected axis so the customer
    // can see the WHY, not just the WHO.
    const drifters: DrifterReason[] = [];
    for (const p of filtered) {
      const axes: string[] = [];
      if (
        p.colorTemp != null &&
        tempMedian != null &&
        Math.abs(p.colorTemp - tempMedian) > COLOR_TEMP_THRESHOLD
      ) {
        axes.push(
          `temp ${p.colorTemp > tempMedian ? "+" : "-"}${Math.round(Math.abs(p.colorTemp - tempMedian))}K`,
        );
      }
      if (
        p.exposure != null &&
        expMedian != null &&
        Math.abs(p.exposure - expMedian) > EXPOSURE_THRESHOLD
      ) {
        axes.push(
          `exp ${p.exposure > expMedian ? "+" : ""}${(p.exposure - expMedian).toFixed(1)}EV`,
        );
      }
      if (
        p.saturation != null &&
        satMedian != null &&
        Math.abs(p.saturation - satMedian) > SATURATION_THRESHOLD
      ) {
        axes.push(
          `sat ${p.saturation > satMedian ? "+" : ""}${Math.round(p.saturation - satMedian)}`,
        );
      }
      if (axes.length > 0) {
        drifters.push({ fileName: p.fileName, axes });
      }
    }

    // Score: 100 if all consistent, drops by 5 per drifter axis-instance
    // and an additional small penalty for total range above threshold.
    const axisHits = drifters.reduce((n, d) => n + d.axes.length, 0);
    let score = 100 - axisHits * 5;
    if (tempRange > COLOR_TEMP_THRESHOLD * 2) score -= 5;
    if (expRange > EXPOSURE_THRESHOLD * 2) score -= 5;
    if (satRange > SATURATION_THRESHOLD * 2) score -= 5;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      drifters,
      total: filtered.length,
      tempRange: Math.round(tempRange),
      expRange: Math.round(expRange * 10) / 10,
      satRange: Math.round(satRange),
      hasTemp: colorTemps.length >= 2,
      hasExp: exposures.length >= 2,
      hasSat: sats.length >= 2,
    };
  }, [photos]);

  if (!data) return null;

  const tone =
    data.drifters.length === 0
      ? "ok"
      : data.drifters.length <= 2
        ? "warn"
        : "alert";

  const badgeStyles =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/35 bg-amber-500/[0.06] text-amber-300"
        : "border-red-500/35 bg-red-500/[0.06] text-red-300";

  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`rounded-md border ${badgeStyles} mt-3`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Layers className="w-3.5 h-3.5" strokeWidth={2} />
          <span className="text-[11px] font-mono uppercase tracking-wider">
            Cross-shoot consistency
          </span>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-3 text-[12px] font-mono">
          <span className="font-semibold stat-num">
            {data.score}
            <span className="opacity-60">/100</span>
          </span>
          <span className="opacity-50">·</span>
          {data.drifters.length === 0 ? (
            <span className="truncate">All {data.total} photos in range</span>
          ) : (
            <span className="truncate">
              {data.drifters.length} of {data.total} photos drift
            </span>
          )}
          <span className="opacity-50 hidden sm:inline">·</span>
          <span className="opacity-70 hidden sm:inline">
            {data.hasTemp ? `Δtemp ${data.tempRange}K` : ""}
            {data.hasExp ? ` · Δexp ${data.expRange}EV` : ""}
            {data.hasSat ? ` · Δsat ${data.satRange}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-current/15 px-3 py-2.5 text-[12px] space-y-2">
          {data.drifters.length === 0 ? (
            <p className="opacity-80">
              Color temp, exposure, and saturation are consistent across the
              set. No photo deviates from the median by more than{" "}
              {COLOR_TEMP_THRESHOLD}K, {EXPOSURE_THRESHOLD}EV, or{" "}
              {SATURATION_THRESHOLD} saturation points.
            </p>
          ) : (
            <>
              <p className="opacity-80">
                Photos that drift from the set median. Reshoot, manual edit,
                or override your Style Profile if the drift is intentional.
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {data.drifters.map((d) => (
                  <li
                    key={d.fileName}
                    className="flex items-start gap-2 font-mono"
                  >
                    <span className="truncate flex-1 opacity-90">
                      {d.fileName}
                    </span>
                    <span className="opacity-70 shrink-0 text-[11px]">
                      {d.axes.join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
