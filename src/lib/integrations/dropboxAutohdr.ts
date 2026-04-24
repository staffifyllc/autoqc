// AutoHDR-via-Dropbox ingest.
//
// The goal: a photographer drops AutoHDR-finished JPEGs into a watched
// Dropbox folder like /AutoQC Inbox/123 Main St/. AutoQC detects the
// drop, creates a Property named after the subfolder, pulls the JPEGs
// into S3, runs QC, and pushes the processed versions back to
// /AutoQC Inbox/123 Main St/Processed/ when QC finishes.
//
// Cursor model: Dropbox's list_folder/continue API. We capture a cursor
// at setup time, and each ingest pass asks "what has changed since this
// cursor?" The new cursor from the response is persisted for next time.
// A 30-minute safety-net cron and the live webhook both call the same
// ingest function; whichever fires first wins and the other is a no-op.

import { Dropbox } from "dropbox";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";
import { s3, BUCKET, getDownloadUrl } from "@/lib/s3";
import { enqueueQCJob } from "@/lib/sqs";

export type DropboxAutohdrCredentials = {
  // OAuth access token. For MVP this is a long-lived token the user
  // pastes in from their Dropbox app console. Proper OAuth flow can
  // come later.
  accessToken: string;
  // Folder path under the Dropbox root that we watch, e.g. "/AutoQC Inbox".
  // All subfolders inside this are treated as properties.
  watchFolder: string;
  // Dropbox account_id for the connected user. Used by the webhook to
  // figure out which agency a change notification belongs to.
  accountId?: string;
  // The user's Dropbox root namespace id. For team accounts this is the
  // TEAM root, which is where shared folders like "/AutoHDR" usually
  // live. Without setting the Dropbox-API-Path-Root header to this id,
  // all paths would resolve against the user's personal namespace and
  // return path/not_found for anything in team space. Captured during
  // initializeCursor and passed on every subsequent API call.
  rootNamespaceId?: string;
  // The Dropbox app's App secret. We store it per-integration because
  // each customer creates their own Dropbox app (at least until we
  // ship a shared-OAuth flow), so there's no single global secret.
  // The webhook validates the X-Dropbox-Signature HMAC against this.
  appSecret?: string;
  // Serialized Dropbox cursor. null after first save, populated after
  // initializeCursor() runs once.
  cursor?: string;
  // Name of the AutoHDR "finished photos" subfolder inside each property
  // directory. AutoHDR workflows commonly write finals to a specific
  // subfolder (e.g. "04-Final-Photos") while raws and videos live in
  // sibling folders that AutoQC must ignore. We only ingest files whose
  // IMMEDIATE PARENT folder matches this name (case-insensitive). The
  // property is the parent of THAT folder. Defaults to "04-Final-Photos".
  finalsSubfolder?: string;
  // "replace_in_place" overwrites the files in <property>/<finalsSubfolder>/
  //   directly — AutoHDR's JPEGs are replaced by AutoQC's reviewed versions.
  // "outbox_folder" leaves originals untouched and writes finals to
  //   <outputFolder>/<property>/ instead.
  outputBehavior?: "replace_in_place" | "outbox_folder";
  // Customer's preferred output folder path when outputBehavior is
  // "outbox_folder". Defaults to "/AutoQC Outbox".
  outputFolder?: string;
  // Timestamp of the most recent successful ingest. Used in the UI.
  lastSyncedAt?: string;
  // Running counters for the UI.
  totalPhotosIngested?: number;
  totalPropertiesPushedBack?: number;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"]);

function isImage(fileName: string): boolean {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

export const DEFAULT_FINALS_SUBFOLDER = "04-Final-Photos";

// Parse a Dropbox path against the watched root. AutoHDR workflows store
// finished JPEGs inside a specific subfolder of each property (default
// "04-Final-Photos"), alongside siblings like "01-RAW-Photos" and
// "05-Final-Video" that we must ignore. We only accept paths shaped like
//   <watchRoot>/.../<propertyName>/<finalsSubfolder>/<file>.jpg
// at any nesting depth. The property folder is the parent of the finals
// subfolder. Returns null for anything else, including files we wrote
// into our own /Processed output (to prevent a feedback loop).
//
// Returns:
//   - propertyFolder: full Dropbox path of the property folder — used as
//     the dedupe key so same-named properties in different months stay
//     separate Properties.
//   - propertyName:   last segment of propertyFolder; shown as the
//     AutoQC property address.
//   - fileName:       the leaf file name.
export function parseDropboxPath(
  fullPath: string,
  watchFolder: string,
  finalsSubfolder: string = DEFAULT_FINALS_SUBFOLDER
): {
  propertyFolder: string;
  propertyName: string;
  fileName: string;
} | null {
  const normalized = fullPath.replace(/\\/g, "/");
  const rootNormalized = watchFolder.replace(/\\/g, "/").replace(/\/$/, "");
  if (!normalized.toLowerCase().startsWith(rootNormalized.toLowerCase() + "/")) {
    return null;
  }
  const relative = normalized.slice(rootNormalized.length + 1);
  const parts = relative.split("/").filter(Boolean);
  // Need at least: ...somewhere.../<property>/<finalsSubfolder>/<file>
  if (parts.length < 3) return null;
  if (parts.some((p) => p.toLowerCase() === "processed")) return null;

  const fileName = parts[parts.length - 1];
  const immediateParent = parts[parts.length - 2];
  if (immediateParent.toLowerCase() !== finalsSubfolder.toLowerCase()) {
    return null;
  }
  const propertyName = parts[parts.length - 3];
  const propertyFolder = `${rootNormalized}/${parts.slice(0, -2).join("/")}`;
  return { propertyFolder, propertyName, fileName };
}

// The Dropbox JS SDK's filesDownload/filesUpload methods call
// response.buffer() internally, which doesn't exist on Node 18+ native
// fetch (it was a node-fetch v2 thing). Hitting the Content API
// directly sidesteps the bug and also gives us explicit control over
// the Dropbox-API-Path-Root header needed for team-root paths.
async function dropboxDownload(
  creds: DropboxAutohdrCredentials,
  path: string
): Promise<Buffer> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.accessToken}`,
    "Dropbox-API-Arg": JSON.stringify({ path }),
  };
  if (creds.rootNamespaceId) {
    headers["Dropbox-API-Path-Root"] = JSON.stringify({
      ".tag": "root",
      root: creds.rootNamespaceId,
    });
  }
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`dropbox download ${res.status}: ${text.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function dropboxUpload(
  creds: DropboxAutohdrCredentials,
  path: string,
  body: Buffer,
  mode: "add" | "overwrite" = "overwrite"
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.accessToken}`,
    "Content-Type": "application/octet-stream",
    "Dropbox-API-Arg": JSON.stringify({
      path,
      mode: { ".tag": mode },
      autorename: false,
      mute: true,
    }),
  };
  if (creds.rootNamespaceId) {
    headers["Dropbox-API-Path-Root"] = JSON.stringify({
      ".tag": "root",
      root: creds.rootNamespaceId,
    });
  }
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers,
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`dropbox upload ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function getDropbox(creds: DropboxAutohdrCredentials) {
  const opts: any = { accessToken: creds.accessToken, fetch: fetch as any };
  // If we know the user's root namespace (team or personal), always pass
  // Dropbox-API-Path-Root = { ".tag": "root", "root": <namespaceId> }. That
  // makes paths resolve the same way they appear in Dropbox's own web UI,
  // which is what users expect when they type "/AutoHDR".
  if (creds.rootNamespaceId) {
    opts.pathRoot = JSON.stringify({
      ".tag": "root",
      root: creds.rootNamespaceId,
    });
  }
  return new Dropbox(opts);
}

// Extract the most useful human-readable line from a Dropbox SDK error.
// The SDK attaches structured errors on .error.error_summary and falls
// back to .message on transport failures.
function describeDropboxError(err: any): string {
  const summary =
    err?.error?.error_summary ??
    err?.error?.error?.[".tag"] ??
    err?.error ??
    err?.message ??
    "unknown";
  if (typeof summary === "object") {
    try {
      return JSON.stringify(summary).slice(0, 200);
    } catch {
      return "unknown";
    }
  }
  return String(summary).slice(0, 200);
}

// Capture a cursor at the current moment so future list_folder/continue
// calls only return things that change after this point. Stored on the
// Integration credentials.
export async function initializeCursor(integrationId: string): Promise<{
  cursor: string;
  accountId: string;
}> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });
  if (!integration || integration.platform !== "DROPBOX_AUTOHDR") {
    throw new Error("Integration not found or wrong platform");
  }
  const creds = integration.credentials as DropboxAutohdrCredentials;
  const dbx = await getDropbox(creds);

  // Step 1: validate the token AND discover whether this is a team account.
  // account.root_info.root_namespace_id is the id to pass as Dropbox-API-Path-Root
  // so paths resolve the way they do in Dropbox's web UI. For team accounts the
  // root namespace is the TEAM root, which is where shared folders like
  // "/AutoHDR" actually live.
  let accountId: string;
  let rootNamespaceId: string | undefined;
  try {
    const accountResult = await dbx.usersGetCurrentAccount();
    const account = accountResult.result as any;
    accountId = account.account_id as string;
    rootNamespaceId = account.root_info?.root_namespace_id;
  } catch (err: any) {
    throw new Error(
      `Dropbox rejected the access token. Generate a new one in the app console (Settings → OAuth 2 → Generate) and make sure the token was created AFTER you submitted the permissions tab. (${describeDropboxError(err)})`
    );
  }

  // Step 2: rebuild the client with path_root so paths resolve against the
  // account's root (team root for team accounts, personal root otherwise).
  const rootedCreds: DropboxAutohdrCredentials = { ...creds, rootNamespaceId };
  const rootedDbx = await getDropbox(rootedCreds);

  // Step 3: capture the watch-folder cursor. If this fails, the path is the problem.
  let cursor: string;
  try {
    const latest = await rootedDbx.filesListFolderGetLatestCursor({
      path: creds.watchFolder,
      recursive: true,
      include_media_info: false,
      include_deleted: false,
      include_has_explicit_shared_members: false,
    });
    cursor = (latest.result as any).cursor as string;
  } catch (err: any) {
    const summary = describeDropboxError(err);
    const scopeMatch = summary.match(/required scope '([^']+)'/);
    const pathHint = summary.includes("path/not_found")
      ? `The folder "${creds.watchFolder}" does not exist in this Dropbox account. Check spelling and capitalization.`
      : scopeMatch ||
        summary.includes("missing_scope") ||
        summary.includes("no_permission") ||
        summary.includes("not permitted")
        ? `Your Dropbox app is missing ${scopeMatch ? `the "${scopeMatch[1]}" scope` : "required scopes"}. In the app console Permissions tab, enable all 5 scopes (files.content.read, files.content.write, files.metadata.read, files.metadata.write, account_info.read), click Submit at the bottom, THEN regenerate the access token. Tokens bake in scopes at creation time, so old tokens need to be replaced.`
        : `Check that the watch folder path "${creds.watchFolder}" exactly matches a folder in this Dropbox.`;
    throw new Error(`${pathHint} (${summary})`);
  }

  const updated: DropboxAutohdrCredentials = {
    ...creds,
    accountId,
    rootNamespaceId,
    cursor,
  };
  await prisma.integration.update({
    where: { id: integrationId },
    data: { credentials: updated as any },
  });

  return { cursor, accountId };
}

// Pull the diff since the saved cursor and ingest any new image files.
// Groups by parent folder so multiple images dropped into one folder
// become one Property.
export async function ingestAgencyDropbox(args: {
  agencyId: string;
}): Promise<{
  ingested: number;
  properties: number;
  skipped: number;
}> {
  const integration = await prisma.integration.findFirst({
    where: {
      agencyId: args.agencyId,
      platform: "DROPBOX_AUTOHDR",
      isActive: true,
    },
  });
  if (!integration) {
    return { ingested: 0, properties: 0, skipped: 0 };
  }
  const creds = integration.credentials as DropboxAutohdrCredentials;
  if (!creds.cursor) {
    await initializeCursor(integration.id);
    return { ingested: 0, properties: 0, skipped: 0 };
  }

  const dbx = await getDropbox(creds);

  // Follow the continue cursor in a loop until has_more is false.
  let cursor = creds.cursor;
  const newEntries: Array<{ path: string; id: string; size: number; serverModified: string }> = [];
  let safety = 0;
  while (safety++ < 50) {
    const res = await dbx.filesListFolderContinue({ cursor });
    const result = res.result as any;
    for (const entry of result.entries ?? []) {
      if (entry[".tag"] !== "file") continue;
      newEntries.push({
        path: entry.path_display ?? entry.path_lower,
        id: entry.id,
        size: entry.size ?? 0,
        serverModified: entry.server_modified,
      });
    }
    cursor = result.cursor;
    if (!result.has_more) break;
  }

  // Group image files by their property folder (the parent of the
  // finals subfolder), skip non-images and anything outside the finals
  // pattern. grouped key = full propertyFolder path (unique across
  // month/quarter/year subtrees).
  const finalsSubfolder = creds.finalsSubfolder || DEFAULT_FINALS_SUBFOLDER;
  type GroupEntry = {
    propertyName: string;
    files: Array<{ path: string; fileName: string }>;
  };
  const grouped = new Map<string, GroupEntry>();
  let skipped = 0;
  for (const entry of newEntries) {
    const parsed = parseDropboxPath(entry.path, creds.watchFolder, finalsSubfolder);
    if (!parsed || !isImage(parsed.fileName)) {
      skipped++;
      continue;
    }
    const existing = grouped.get(parsed.propertyFolder);
    if (existing) {
      existing.files.push({ path: entry.path, fileName: parsed.fileName });
    } else {
      grouped.set(parsed.propertyFolder, {
        propertyName: parsed.propertyName,
        files: [{ path: entry.path, fileName: parsed.fileName }],
      });
    }
  }

  let totalIngested = 0;
  let totalProperties = 0;

  const entries = Array.from(grouped.entries());
  for (const [sourceFolder, { propertyName, files }] of entries) {
    // Find or create the Property. Use dropboxSourceFolder as the dedupe
    // key so repeated drops into the same folder append to the same
    // property rather than creating a new one every time.
    let property = await prisma.property.findFirst({
      where: {
        agencyId: args.agencyId,
        dropboxSourceFolder: sourceFolder,
      },
    });
    if (!property) {
      property = await prisma.property.create({
        data: {
          agencyId: args.agencyId,
          address: propertyName,
          dropboxSourceFolder: sourceFolder,
          dropboxIntegrationId: integration.id,
        },
      });
      totalProperties++;
    }

    const newPhotoIds: string[] = [];
    for (const f of files) {
      // Skip filenames that are already ingested on this property.
      const exists = await prisma.photo.findFirst({
        where: { propertyId: property.id, fileName: f.fileName },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }

      // Download from Dropbox (via direct Content API — SDK is broken
      // on native fetch), upload to S3.
      const fileBinary = await dropboxDownload(creds, f.path);
      const fileSize = fileBinary.byteLength;

      const s3Key = `${args.agencyId}/${property.id}/original/${f.fileName}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
          Body: fileBinary,
          ContentType: mimeFor(f.fileName),
        })
      );

      const photo = await prisma.photo.create({
        data: {
          propertyId: property.id,
          fileName: f.fileName,
          s3KeyOriginal: s3Key,
          fileSize,
        },
      });
      newPhotoIds.push(photo.id);
      totalIngested++;
    }

    // Enqueue all newly-ingested photos for this property as one batch.
    if (newPhotoIds.length > 0) {
      await enqueueQCJob({
        propertyId: property.id,
        agencyId: args.agencyId,
        photoIds: newPhotoIds,
        tier: property.tier,
      });
    }
  }

  // Persist the updated cursor and counters.
  const prevIngested = creds.totalPhotosIngested ?? 0;
  const newCreds: DropboxAutohdrCredentials = {
    ...creds,
    cursor,
    lastSyncedAt: new Date().toISOString(),
    totalPhotosIngested: prevIngested + totalIngested,
  };
  await prisma.integration.update({
    where: { id: integration.id },
    data: { credentials: newCreds as any },
  });

  return {
    ingested: totalIngested,
    properties: totalProperties,
    skipped,
  };
}

// Push processed (auto-fixed or original, whichever the user ended up
// with) files back to Dropbox for properties that finished QC and have
// not yet been pushed. Called from the same cron as ingest.
export async function pushCompletedProperties(args: {
  agencyId: string;
}): Promise<{ propertiesPushed: number; photosPushed: number }> {
  const integration = await prisma.integration.findFirst({
    where: {
      agencyId: args.agencyId,
      platform: "DROPBOX_AUTOHDR",
      isActive: true,
    },
  });
  if (!integration) return { propertiesPushed: 0, photosPushed: 0 };
  const creds = integration.credentials as DropboxAutohdrCredentials;
  const dbx = await getDropbox(creds);

  const candidates = await prisma.property.findMany({
    where: {
      agencyId: args.agencyId,
      dropboxIntegrationId: integration.id,
      dropboxPushedAt: null,
    },
    include: { photos: true },
  });

  const TERMINAL = new Set([
    "PASSED",
    "FIXED",
    "FLAGGED",
    "APPROVED",
    "REJECTED",
  ]);

  let propertiesPushed = 0;
  let photosPushed = 0;

  for (const property of candidates) {
    if (property.photos.length === 0) continue;
    const allTerminal = property.photos.every((p) => TERMINAL.has(p.status));
    if (!allTerminal) continue;

    const finalsSub = creds.finalsSubfolder || DEFAULT_FINALS_SUBFOLDER;
    // replace_in_place: write back to the same finals folder AutoHDR used,
    // overwriting the original JPEGs. Safe from feedback loops because
    // ingest dedupes by (propertyId, fileName) — a filename we already
    // know is skipped on the next webhook.
    const outputBase =
      creds.outputBehavior === "outbox_folder"
        ? `${(creds.outputFolder ?? "/AutoQC Outbox").replace(/\/$/, "")}/${property.address}`
        : `${(property.dropboxSourceFolder ?? "").replace(/\/$/, "")}/${finalsSub}`;

    try {
      await dbx.filesCreateFolderV2({ path: outputBase });
    } catch (err: any) {
      if (!String(err?.error?.error_summary ?? "").includes("path/conflict")) {
        console.error("[dropbox-autohdr] create folder failed:", err);
        continue;
      }
    }

    for (const photo of property.photos) {
      const key = photo.useOriginal || !photo.s3KeyFixed ? photo.s3KeyOriginal : photo.s3KeyFixed;
      const url = await getDownloadUrl(key);
      const imgRes = await fetch(url);
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      try {
        await dropboxUpload(
          creds,
          `${outputBase}/${photo.fileName}`,
          buf,
          "overwrite"
        );
        photosPushed++;
      } catch (err) {
        console.error("[dropbox-autohdr] upload failed for", photo.fileName, err);
      }
    }

    await prisma.property.update({
      where: { id: property.id },
      data: { dropboxPushedAt: new Date() },
    });
    propertiesPushed++;
  }

  const newCreds: DropboxAutohdrCredentials = {
    ...creds,
    totalPropertiesPushedBack:
      (creds.totalPropertiesPushedBack ?? 0) + propertiesPushed,
  };
  await prisma.integration.update({
    where: { id: integration.id },
    data: { credentials: newCreds as any },
  });

  return { propertiesPushed, photosPushed };
}

function mimeFor(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  return "image/jpeg";
}
