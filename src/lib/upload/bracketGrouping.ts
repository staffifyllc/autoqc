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

// Extract the YYYYMMDDHHMMSS timestamp portion of a filename as a
// raw string. Used as a primary "same scene" signal because for DJI
// the timestamp in the name is exactly the AEB capture instant — all
// 5 brackets share the same 14-digit prefix. Direct string-equality
// is the cleanest "these are the same set" detector we can get.
function timestampKeyFromFileName(name: string): string | null {
  // Any 14 consecutive digits that parse as a valid date. Permissive
  // about what surrounds the digits because DJI / Sony / Canon all
  // pack the timestamp slightly differently.
  const m = name.match(/(\d{14})/);
  if (!m) return null;
  const ts = m[1];
  const y = parseInt(ts.slice(0, 4), 10);
  const mo = parseInt(ts.slice(4, 6), 10);
  const d = parseInt(ts.slice(6, 8), 10);
  const h = parseInt(ts.slice(8, 10), 10);
  const mi = parseInt(ts.slice(10, 12), 10);
  const s = parseInt(ts.slice(12, 14), 10);
  if (
    y < 2000 || y > 2100 ||
    mo < 1 || mo > 12 ||
    d < 1 || d > 31 ||
    h > 23 || mi > 59 || s > 59
  ) {
    return null;
  }
  return ts;
}

function timestampFromFileName(name: string): Date | null {
  const ts = timestampKeyFromFileName(name);
  if (!ts) return null;
  const iso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}

// Augmented metadata that carries the raw filename timestamp string
// alongside the parsed Date. The grouping algorithm prefers string-
// equality on the raw key over Date math because identical strings
// are an unambiguous "same scene" signal that no time-gap heuristic
// can match.
interface BracketFileExt extends BracketFile {
  filenameKey: string | null;
}

export async function readBracketMetadata(
  files: File[]
): Promise<BracketFile[]> {
  const result = await Promise.all(
    files.map(async (file): Promise<BracketFileExt> => {
      // PRIMARY: filename timestamp. For DJI this is rock-solid and
      // exifr fails on a meaningful fraction of DJI DNG variants.
      const filenameKey = timestampKeyFromFileName(file.name);
      let captured: Date | null = filenameKey
        ? timestampFromFileName(file.name)
        : null;
      let bias: number | null = null;

      // SECONDARY: exifr for ExposureBiasValue (and DateTimeOriginal
      // if filename had no timestamp).
      try {
        const tags = await exifr.parse(file, [
          "DateTimeOriginal",
          "CreateDate",
          "ExposureBiasValue",
          "ExposureCompensation",
        ]);
        if (!captured) {
          captured =
            (tags?.DateTimeOriginal as Date | undefined) ??
            (tags?.CreateDate as Date | undefined) ??
            null;
        }
        const b =
          (tags?.ExposureBiasValue as number | undefined) ??
          (tags?.ExposureCompensation as number | undefined) ??
          null;
        bias = typeof b === "number" ? b : null;
      } catch {
        /* exifr failed — filename path already gave us what we need */
      }

      return {
        file,
        capturedAt: captured,
        exposureBias: bias,
        filenameKey,
      };
    })
  );
  // Stash the filenameKey on the file objects via WeakMap so
  // groupIntoBrackets can use it without changing the public type.
  for (const r of result) {
    filenameKeys.set(r.file, r.filenameKey);
  }
  return result;
}

// Side-channel mapping from File to the filename timestamp key so
// groupIntoBrackets can read it without expanding the public
// BracketFile type.
const filenameKeys = new WeakMap<File, string | null>();

export function groupIntoBrackets(meta: BracketFile[]): BracketGroup[] {
  // Strategy:
  //   PASS 1: Group by the filename's 14-digit YYYYMMDDHHMMSS key.
  //     All files that share that key are unambiguously the same
  //     AEB scene (DJI, Sony, Canon naming pattern). Bulletproof.
  //   PASS 2: For files that had no filename key, fall back to the
  //     time-gap + EV-reset heuristic on parsed timestamps.
  //   PASS 3: Anything still ungrouped becomes a singleton.

  const grouped: BracketGroup[] = [];
  const byFilenameKey = new Map<string, BracketFile[]>();
  const noKey: BracketFile[] = [];

  for (const m of meta) {
    const key = filenameKeys.get(m.file) ?? null;
    if (key) {
      const arr = byFilenameKey.get(key) ?? [];
      arr.push(m);
      byFilenameKey.set(key, arr);
    } else {
      noKey.push(m);
    }
  }

  const sceneNameFor = (idx: number) =>
    `Scene_${String(idx + 1).padStart(3, "0")}`;

  const pickThumbnail = (bracket: BracketFile[]): File => {
    const sorted = [...bracket].sort((a, b) => {
      const ab = a.exposureBias ?? 0;
      const bb = b.exposureBias ?? 0;
      return ab - bb;
    });
    return sorted[Math.floor(sorted.length / 2)].file;
  };

  // PASS 1: filename-key groups. Sort the keys so scenes appear in
  // chronological order in the UI.
  const sortedKeys = Array.from(byFilenameKey.keys()).sort();
  for (const key of sortedKeys) {
    const bracket = byFilenameKey.get(key)!;
    const sortedByBias = [...bracket].sort((a, b) => {
      const ab = a.exposureBias ?? 0;
      const bb = b.exposureBias ?? 0;
      return ab - bb;
    });
    grouped.push({
      sceneName: sceneNameFor(grouped.length),
      files: sortedByBias.map((m) => m.file),
      thumbnail: pickThumbnail(bracket),
    });
  }

  // PASS 2: time-based fallback for the files without filename keys.
  const dated = noKey.filter(
    (m): m is BracketFile & { capturedAt: Date } => Boolean(m.capturedAt)
  );
  const orphans = noKey.filter((m) => !m.capturedAt);
  const sorted = [...dated].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
  );

  let current: (BracketFile & { capturedAt: Date })[] = [];
  const flush = () => {
    if (current.length === 0) return;
    grouped.push({
      sceneName: sceneNameFor(grouped.length),
      files: [...current]
        .sort((a, b) => (a.exposureBias ?? 0) - (b.exposureBias ?? 0))
        .map((m) => m.file),
      thumbnail: pickThumbnail(current),
    });
    current = [];
  };

  // Scene break is TIME-GAP ONLY. We deliberately do NOT break on an
  // exposure-bias drop: Sony AEB brackets center-out (0, -2, +2, -4,
  // +4) so the bias falls mid-scene at 0->-2 and +2->-4. An EV-reset
  // rule shatters every Sony scene into a singleton + pairs. Real
  // bracket frames share a capture instant (intra-scene gaps 0-1s)
  // while scenes are tens of seconds apart, so the gap alone is a
  // clean, camera-agnostic separator. (DJI is already handled by the
  // filename-key pass above and never reaches this loop.)
  for (const m of sorted) {
    if (current.length === 0) {
      current.push(m);
      continue;
    }
    const prev = current[current.length - 1];
    const gap = (m.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;
    if (gap > GAP_THRESHOLD_SECONDS) flush();
    current.push(m);
  }
  flush();

  // PASS 3: untimed orphans become singletons.
  for (const o of orphans) {
    grouped.push({
      sceneName: o.file.name.replace(/\.[^.]+$/, ""),
      files: [o.file],
      thumbnail: o.file,
    });
  }

  return grouped;
}
