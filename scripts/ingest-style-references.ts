/**
 * Ingest finished JPEGs as reference photos for an agency's
 * StyleProfile, then trigger the profile-learner Lambda so the LAB
 * style histogram gets computed and stored.
 *
 * Sources: a local folder, one or more Dropbox shared links, or both.
 *
 * Usage:
 *   npx tsx scripts/ingest-style-references.ts \
 *     --agency "Flylisted" \
 *     [--folder ~/Downloads/finished-samples] \
 *     [--dropbox-link https://www.dropbox.com/scl/fo/...] \
 *     [--dropbox-link <another>] \
 *     [--profile "Flylisted Default"] \
 *     [--limit 1000]
 *
 * Dropbox requires a personal access token in DROPBOX_ACCESS_TOKEN
 * env var (Dropbox app console → Generate). The token only needs to
 * be valid; shared link access doesn't require ownership of the link.
 *
 * Once this completes, the HDR Lambda automatically applies the
 * learned histogram to every Mertens-fused or single-RAW-decoded
 * image for that agency.
 */
import { promises as fs } from "fs";
import { resolve, basename, extname } from "path";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Dropbox } from "dropbox";
import { prisma } from "../src/lib/db";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET;
const LAMBDA_NAME = "photoqc-profile-learner";

const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  // Collect every --dropbox-link occurrence so multiple folders can
  // ingest in one shot.
  const dropboxLinks: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dropbox-link" && i + 1 < args.length) {
      dropboxLinks.push(args[i + 1]);
    }
  }
  return {
    agency: get("--agency"),
    folder: get("--folder"),
    dropboxLinks,
    profileName: get("--profile") ?? "Default",
    limit: get("--limit") ? parseInt(get("--limit")!, 10) : Infinity,
    dryRun: args.includes("--dry-run"),
  };
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

function isImage(name: string): boolean {
  return IMAGE_EXTS.includes(extname(name).toLowerCase());
}

async function findAgency(name: string) {
  const matches = await prisma.agency.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (matches.length === 0) {
    throw new Error(`No agency matching "${name}"`);
  }
  if (matches.length > 1) {
    console.log("Multiple matches:");
    console.table(matches);
    throw new Error(
      `Be more specific. ${matches.length} agencies matched "${name}".`
    );
  }
  return matches[0];
}

async function findOrCreateProfile(agencyId: string, name: string) {
  let profile = await prisma.styleProfile.findFirst({
    where: { agencyId, name },
  });
  if (!profile) {
    profile = await prisma.styleProfile.create({
      data: {
        agencyId,
        name,
        isDefault: true,
        referencePhotos: [],
      },
    });
    console.log(`Created StyleProfile "${name}" (${profile.id})`);
  } else {
    console.log(`Reusing StyleProfile "${name}" (${profile.id})`);
  }
  return profile;
}

async function listJpegs(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (isImage(e.name)) {
      out.push(resolve(folder, e.name));
    }
  }
  return out;
}

// One logical reference photo source. Either local-file or
// dropbox-streaming. The uploader doesn't care which.
type RefSource =
  | { kind: "local"; path: string; displayName: string }
  | { kind: "dropbox"; dbx: Dropbox; sharedLink: string; path: string; displayName: string };

async function listDropboxImages(
  dbx: Dropbox,
  sharedLink: string
): Promise<RefSource[]> {
  const out: RefSource[] = [];
  // Dropbox list_folder accepts a shared_link parameter. Walks the
  // folder, paginating with has_more / cursor. Recurses into subfolders.
  let cursor: string | undefined;
  while (true) {
    const resp: any = cursor
      ? await (dbx as any).filesListFolderContinue({ cursor })
      : await (dbx as any).filesListFolder({
          path: "",
          recursive: true,
          shared_link: { url: sharedLink },
        });
    for (const entry of resp.result.entries) {
      if (entry[".tag"] !== "file") continue;
      if (!isImage(entry.name)) continue;
      out.push({
        kind: "dropbox",
        dbx,
        sharedLink,
        path: entry.path_lower ?? entry.path_display ?? "",
        displayName: entry.name,
      });
    }
    if (!resp.result.has_more) break;
    cursor = resp.result.cursor;
  }
  return out;
}

async function fetchDropboxBytes(
  dbx: Dropbox,
  sharedLink: string,
  path: string
): Promise<Buffer> {
  // sharing/get_shared_link_file streams the file contents from a
  // shared-link path. Returns a fileBinary buffer.
  const resp: any = await (dbx as any).sharingGetSharedLinkFile({
    url: sharedLink,
    path,
  });
  const blob = resp.result.fileBinary as Buffer | Uint8Array | undefined;
  if (blob) return Buffer.from(blob as any);
  // Some SDK versions return a Blob — fall back to arrayBuffer.
  if (resp.result.fileBlob && typeof resp.result.fileBlob.arrayBuffer === "function") {
    return Buffer.from(await resp.result.fileBlob.arrayBuffer());
  }
  throw new Error(`Unexpected Dropbox response for ${path}`);
}

async function uploadOne(
  agencyId: string,
  profileId: string,
  source: RefSource
): Promise<string> {
  const fileName = source.displayName;
  const key = `${agencyId}/style-references/${profileId}/${fileName}`;
  // Skip if already there (re-running is safe and resumable).
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return key; // already uploaded
  } catch {
    /* fall through to upload */
  }
  const body =
    source.kind === "local"
      ? await fs.readFile(source.path)
      : await fetchDropboxBytes(source.dbx, source.sharedLink, source.path);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: fileName.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg",
    })
  );
  return key;
}

async function main() {
  const { agency, folder, dropboxLinks, profileName, limit, dryRun } =
    parseArgs();
  if (!agency || (!folder && dropboxLinks.length === 0)) {
    console.error(
      "Usage: ingest-style-references --agency <name> (--folder <path> | --dropbox-link <url> [--dropbox-link <url>...]) [--profile <name>] [--limit N]"
    );
    process.exit(1);
  }
  if (!BUCKET) {
    console.error("AWS_S3_BUCKET env var not set");
    process.exit(1);
  }

  const ag = await findAgency(agency);
  console.log(`Agency: ${ag.name} (${ag.id})`);

  // Build the list of reference sources from whatever the user provided.
  const sources: RefSource[] = [];

  if (folder) {
    const locals = await listJpegs(resolve(folder));
    for (const p of locals) {
      sources.push({ kind: "local", path: p, displayName: basename(p) });
    }
    console.log(
      `Local folder: ${locals.length} JPEG/PNG/TIFF files in ${folder}`
    );
  }

  if (dropboxLinks.length > 0) {
    const token = process.env.DROPBOX_ACCESS_TOKEN;
    if (!token) {
      console.error(
        "DROPBOX_ACCESS_TOKEN env var is required when using --dropbox-link.\n" +
          "Get one from https://www.dropbox.com/developers/apps (your app → Generate access token)."
      );
      process.exit(1);
    }
    const dbx = new Dropbox({ accessToken: token, fetch });
    for (const link of dropboxLinks) {
      try {
        const found = await listDropboxImages(dbx, link);
        sources.push(...found);
        console.log(`Dropbox: ${found.length} images at ${link.slice(0, 80)}...`);
      } catch (e) {
        console.error(
          `Failed to list Dropbox link ${link}: ${
            e instanceof Error ? e.message : e
          }`
        );
      }
    }
  }

  const trimmed = sources.slice(0, limit);
  console.log(`Total sources: ${sources.length}; using ${trimmed.length}.`);

  if (trimmed.length === 0) {
    console.log("Nothing to ingest.");
    return;
  }

  if (dryRun) {
    console.log("Dry run; exiting before upload/learn.");
    return;
  }

  const profile = await findOrCreateProfile(ag.id, profileName);

  // Upload in parallel waves of 8 so a 1000-file ingest doesn't
  // saturate the network or hit S3 rate limits.
  const WAVE = 8;
  const keys: string[] = [];
  for (let i = 0; i < trimmed.length; i += WAVE) {
    const wave = trimmed.slice(i, i + WAVE);
    const uploaded = await Promise.all(
      wave.map((src) => uploadOne(ag.id, profile.id, src))
    );
    keys.push(...uploaded);
    process.stdout.write(
      `\rUploaded ${Math.min(i + WAVE, trimmed.length)} / ${trimmed.length}`
    );
  }
  process.stdout.write("\n");

  // Merge new keys into the profile's existing references (idempotent).
  const merged = Array.from(new Set([...profile.referencePhotos, ...keys]));
  await prisma.styleProfile.update({
    where: { id: profile.id },
    data: { referencePhotos: merged },
  });
  console.log(
    `StyleProfile now has ${merged.length} reference photos. Triggering profile-learner Lambda...`
  );

  const invoke = await lambda.send(
    new InvokeCommand({
      FunctionName: LAMBDA_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({ body: JSON.stringify({ profileId: profile.id }) })
      ),
    })
  );
  const payload = invoke.Payload
    ? Buffer.from(invoke.Payload).toString("utf-8")
    : "";
  console.log("Lambda response:", payload.slice(0, 600));
  console.log(
    "\nDone. Re-run any HDR shoot for this agency to see the matched output."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
