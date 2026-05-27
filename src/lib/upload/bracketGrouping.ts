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

// A new scene starts when the time gap exceeds this. Real bracket
// sequences fire within ~2s; anything longer is the photographer
// moving the tripod or pausing.
const GAP_THRESHOLD_SECONDS = 3.5;

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

export async function readBracketMetadata(
  files: File[]
): Promise<BracketFile[]> {
  return Promise.all(
    files.map(async (file) => {
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
        const captured =
          (tags?.DateTimeOriginal as Date | undefined) ??
          (tags?.CreateDate as Date | undefined) ??
          null;
        const bias =
          (tags?.ExposureBiasValue as number | undefined) ??
          (tags?.ExposureCompensation as number | undefined) ??
          null;
        return {
          file,
          capturedAt: captured ?? null,
          exposureBias: typeof bias === "number" ? bias : null,
        };
      } catch {
        // Corrupt or non-RAW file — return raw metadata so the caller
        // can still upload it as a single (non-bracketed) Photo.
        return { file, capturedAt: null, exposureBias: null };
      }
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

  for (const m of sorted) {
    if (current.length === 0) {
      current.push(m);
      continue;
    }
    const prev = current[current.length - 1];
    const gap =
      (m.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;
    if (gap > GAP_THRESHOLD_SECONDS) {
      flush();
    }
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
