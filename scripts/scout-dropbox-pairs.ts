/**
 * scout-dropbox-pairs.ts
 *
 * READ-ONLY reconnaissance of a Dropbox account to find raw->finished
 * training pairs for the editor-style model. Does NOT download or
 * modify anything — only lists folder metadata and counts file types.
 *
 * Reports, per folder:
 *   - raw count   (ARW/DNG/CR2/CR3/NEF/RAF/ORF/RW2)
 *   - finished count (JPG/JPEG)
 * and flags folders (or sibling folders) that contain BOTH — those are
 * candidate paired training sets.
 *
 * Usage:
 *   DROPBOX_ACCESS_TOKEN=sl.xxxx npx tsx scripts/scout-dropbox-pairs.ts [--path "/Real Estate"] [--max 100000]
 *
 * Token needs scopes: files.metadata.read (content.read NOT required for
 * scouting — we never download here).
 */
import { Dropbox } from "dropbox";

const RAW_EXTS = new Set([
  "arw", "dng", "cr2", "cr3", "nef", "raf", "orf", "rw2",
]);
const FIN_EXTS = new Set(["jpg", "jpeg"]);

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (f: string) => {
    const i = a.indexOf(f);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : undefined;
  };
  return {
    rootPath: get("--path") ?? "", // "" = entire Dropbox
    max: get("--max") ? parseInt(get("--max")!, 10) : 500000,
  };
}

async function main() {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "DROPBOX_ACCESS_TOKEN not set. Get one from your Dropbox app " +
        "(Settings -> OAuth 2 -> Generated access token) and run:\n" +
        '  DROPBOX_ACCESS_TOKEN=sl.xxxx npx tsx scripts/scout-dropbox-pairs.ts'
    );
    process.exit(1);
  }
  const { rootPath, max } = parseArgs();
  const dbx = new Dropbox({ accessToken: token, fetch });

  // folder path -> {raw, fin}
  const folders = new Map<string, { raw: number; fin: number }>();
  let totalFiles = 0;
  let totalRaw = 0;
  let totalFin = 0;

  const bump = (folder: string, kind: "raw" | "fin") => {
    const cur = folders.get(folder) ?? { raw: 0, fin: 0 };
    cur[kind] += 1;
    folders.set(folder, cur);
  };

  console.log(
    `Scanning Dropbox${rootPath ? ` under "${rootPath}"` : " (entire account)"}... read-only.`
  );

  let resp: any = await (dbx as any).filesListFolder({
    path: rootPath,
    recursive: true,
    limit: 2000,
  });
  const consume = (entries: any[]) => {
    for (const e of entries) {
      if (e[".tag"] !== "file") continue;
      totalFiles += 1;
      const x = ext(e.name);
      const folder = (e.path_display || e.path_lower || "")
        .split("/")
        .slice(0, -1)
        .join("/");
      if (RAW_EXTS.has(x)) {
        totalRaw += 1;
        bump(folder, "raw");
      } else if (FIN_EXTS.has(x)) {
        totalFin += 1;
        bump(folder, "fin");
      }
    }
  };
  consume(resp.result.entries);
  while (resp.result.has_more && totalFiles < max) {
    resp = await (dbx as any).filesListFolderContinue({
      cursor: resp.result.cursor,
    });
    consume(resp.result.entries);
    process.stdout.write(`\r  scanned ${totalFiles} files...`);
  }
  process.stdout.write("\n");

  // A "paired" candidate = a folder with raws whose own or PARENT or
  // SIBLING folder has finished JPEGs. Real estate shoots often put
  // raws in a subfolder and finals in a sibling (e.g. "RAW" + "FIN").
  const folderList = Array.from(folders.entries());
  const finByParent = new Map<string, number>();
  for (const [path, c] of folderList) {
    const parent = path.split("/").slice(0, -1).join("/");
    finByParent.set(parent, (finByParent.get(parent) ?? 0) + c.fin);
  }

  let pairedRawFolders = 0;
  let pairedRawCount = 0;
  const examples: string[] = [];
  for (const [path, c] of folderList) {
    if (c.raw === 0) continue;
    const parent = path.split("/").slice(0, -1).join("/");
    const finNearby =
      c.fin > 0 || (finByParent.get(parent) ?? 0) > 0;
    if (finNearby) {
      pairedRawFolders += 1;
      pairedRawCount += c.raw;
      if (examples.length < 12) {
        examples.push(
          `${path}  (raw=${c.raw}, fin_here=${c.fin}, fin_sibling=${
            (finByParent.get(parent) ?? 0) - c.fin
          })`
        );
      }
    }
  }

  console.log("\n=== Dropbox raw/finished landscape ===");
  console.log(`Total files scanned:        ${totalFiles}`);
  console.log(`Total RAW frames:           ${totalRaw}`);
  console.log(`Total finished JPEGs:       ${totalFin}`);
  console.log(`Folders containing raws:    ${folderList.filter((f) => f[1].raw > 0).length}`);
  console.log(`Raw folders with finals nearby (paired candidates): ${pairedRawFolders}`);
  console.log(`Raw frames in paired folders: ${pairedRawCount}`);
  console.log("\nExample paired folders:");
  for (const e of examples) console.log("  " + e);
  console.log(
    "\nRough training-pair estimate: ~" +
      Math.round(pairedRawCount / 5) +
      " scenes (assuming 5 brackets each)."
  );
}

main().catch((e) => {
  console.error("Scout failed:", e?.error ?? e?.message ?? e);
  process.exit(1);
});
