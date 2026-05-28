/**
 * Client-side bracket grouping for the HDR merge flow.
 *
 * Reads EXIF capture timestamp + exposure bias from RAW files and
 * clusters consecutive shots into bracket sets. Sony A7III/A7IV
 * bracket sequences fire ~0.3-1.5s apart with monotonically changing
 * exposure bias (-2, -1, 0, +1, +2 for a 5-bracket set).
 *
 * Grouping heuristic:
 *  - Sort all files by EXIF DateTimeOriginal.
 *  - A "scene break" happens when the next shot is more than
 *    GAP_THRESHOLD_SECONDS after the previous one OR the exposure
 *    bias direction reverses without an EV ladder reset.
 *  - Inside a scene, files are stored darkest-EV first.
 *  - The thumbnail is the median-EV shot (middle of the sorted set).
 *
 * exifr is browser-friendly and parses ARW, CR2/CR3, NEF, RAF, etc.
 * by reading the embedded TIFF metadata.
 */

import exifr from "exifr";

const RAW_EXTENSIONS = ["arw", "cr2", "cr3", "nef", "dng", "raf", "orf", "rw2"];

// A new scene starts when the time gap between consecutive captures
// exceeds this. Empirically 10s captures both:
//   - Sony A7III/A7IV interior brackets, which fire within ~2s
//   - DJI Mavic / Air AEB brackets, which can be slower because the
//     drone has to settle between frames
// If two real scenes accidentally merge because the photographer
// moved on faster than expected, raise this; if singletons appear
// from one scene because there's a long pause mid-set, lower it.
// Paul's call after observing real Flylisted shoots.
const GAP_THRESHOLD_SECONDS = 10;

export interface BracketFile {
  file: File;
  capturedAt: Date | null;
  exposureBias: number | null;
}

export interface BracketGroup {
  sceneName: string;
  // Files sorted darkest-EV first.
  files: File[];
  // Median-EV file used as the pre-merge thumbnail.
  thumbnail: File;
}

export function isRawFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return RAW_EXTENSIONS.includes(ext);
}

// Last-resort timestamp parse from filename patterns commonly used by
// drone + DSLR firmware. Many DJI bodies (and some Sony Action cams)
// drop EXIF datetime into the filename: DJI_20260226144310_0016_D.dng
// has "20260226144310" = 2026-02-26 14:43:10. When exifr cannot read
// the embedded EXIF (some DJI DNG variants have non-standard tags)
// this lets us still group brackets correctly. Returns null if no
// recognizable pattern matches.
function timestampFromFileName(name: string): Date | null {
  // DJI: 14-digit YYYYMMDDHHMMSS surrounded by underscores
  const dji = name.match(/_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/);
  if (dji) {
    const [, y, mo, d, h, mi, s] = dji;
    const dt = new Date(
      `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
    );
    if (!isNaN(dt.getTime())) return dt;
  }
  // Sony / generic: YYYYMMDD_HHMMSS or YYYYMMDDHHMMSS at any position
  const generic = name.match(/(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/);
  if (generic) {
    const [, y, mo, d, h, mi, s] = generic;
    const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

export async function readBracketMetadata(
  files: File[]
): Promise<BracketFile[]> {
  return Promise.all(
    files.map(async (file) => {
      let captured: Date | null = null;
      let bias: number | null = null;
      try {
        // exifr extracts the small set of EXIF tags we actually need
        // without parsing the full preview JPEG; keeps the browser
        // responsive even for 100+ RAW files.
        const tags = await exifr.parse(file, [
          "DateTimeOriginal",
          "CreateDate",
          "ExposureBiasValue",
          "ExposureCompensation",
        ]);
        captured =
          (tags?.DateTimeOriginal as Date | undefined) ??
          (tags?.CreateDate as Date | undefined) ??
          null;
        const b =
          (tags?.ExposureBiasValue as number | undefined) ??
          (tags?.ExposureCompensation as number | undefined) ??
          null;
        bias = typeof b === "number" ? b : null;
      } catch {
        /* fall through to filename-based fallback */
      }
      // Fallback: DJI / Sony / generic timestamp in the file name.
      // Without this, exifr-incompatible RAWs end up as singletons
      // even when they are obviously consecutive bracket frames.
      if (!captured) {
        captured = timestampFromFileName(file.name);
      }
      return {
        file,
        capturedAt: captured,
        exposureBias: bias,
      };
    })
  );
}

export function groupIntoBrackets(meta: BracketFile[]): BracketGroup[] {
  // Files without timestamps cannot participate in grouping; each one
  // becomes its own single-file "group" so the caller can still upload
  // them, just outside the HDR path.
  const dated = meta.filter((m): m is BracketFile & { capturedAt: Date } =>
    Boolean(m.capturedAt)
  );
  const orphans = meta.filter((m) => !m.capturedAt);

  const sorted = [...dated].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
  );

  const groups: BracketGroup[] = [];
  let current: (BracketFile & { capturedAt: Date })[] = [];

  const flush = () => {
    if (current.length === 0) return;
    // Sort by exposureBias ascending (darkest first); fall back to
    // timestamp order if bias is missing.
    const sortedByBias = [...current].sort((a, b) => {
      const aBias = a.exposureBias ?? 0;
      const bBias = b.exposureBias ?? 0;
      if (aBias === bBias) {
        return a.capturedAt.getTime() - b.capturedAt.getTime();
      }
      return aBias - bBias;
    });
    const median = sortedByBias[Math.floor(sortedByBias.length / 2)];
    groups.push({
      sceneName: `Scene_${String(groups.length + 1).padStart(3, "0")}`,
      files: sortedByBias.map((m) => m.file),
      thumbnail: median.file,
    });
    current = [];
  };

  // Group break logic: any of
  //   - time gap > GAP_THRESHOLD_SECONDS
  //   - EV ladder reset: a sharp drop in ExposureBiasValue from the
  //     previous shot (>= 1.5 stops down). AEB sequences fire
  //     monotonically increasing EV; when the bias jumps back DOWN
  //     by more than a stop, that's a new sequence starting, even
  //     if it happened within the time window. This is the actual
  //     signal that catches DJI and Sony bracketing — time alone
  //     misses fast-paced shoots where scenes are <10s apart.
  for (const m of sorted) {
    if (current.length === 0) {
      current.push(m);
      continue;
    }
    const prev = current[current.length - 1];
    const gap = (m.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;

    let shouldBreak = gap > GAP_THRESHOLD_SECONDS;

    if (
      !shouldBreak &&
      typeof prev.exposureBias === "number" &&
      typeof m.exposureBias === "number"
    ) {
      // EV reset detection. Allow small wobble; only treat a drop of
      // 1.5 stops or more as a new bracket set starting. Within a
      // ladder EV always goes UP, never down.
      const evDelta = m.exposureBias - prev.exposureBias;
      if (evDelta <= -1.5) {
        shouldBreak = true;
      }
    }

    if (shouldBreak) flush();
    current.push(m);
  }
  flush();

  for (const o of orphans) {
    groups.push({
      sceneName: o.file.name.replace(/\.[^.]+$/, ""),
      files: [o.file],
      thumbnail: o.file,
    });
  }

  return groups;
}
