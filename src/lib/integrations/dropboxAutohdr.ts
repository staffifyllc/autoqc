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
  // Serialized Dropbox cursor. null after first save, populated after
  // initializeCursor() runs once.
  cursor?: string;
  // "processed_subfolder" pushes finals to /AutoQC Inbox/<property>/Processed/
  // "outbox_folder" pushes finals to /AutoQC Outbox/<property>/
  outputBehavior?: "processed_subfolder" | "outbox_folder";
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

// Parse a Dropbox path like /AutoQC Inbox/123 Main St/IMG_0001.jpg
// against the watched root /AutoQC Inbox, returning the subfolder
// (property name) and the file name. Returns null if the path is not
// in a subfolder of the watched root (we ignore files dropped
// directly at the root or in /Processed paths that we wrote).
export function parseDropboxPath(
  fullPath: string,
  watchFolder: string
): { subfolder: string; fileName: string } | null {
  const normalized = fullPath.replace(/\\/g, "/");
  const rootNormalized = watchFolder.replace(/\\/g, "/").replace(/\/$/, "");
  if (!normalized.toLowerCase().startsWith(rootNormalized.toLowerCase() + "/")) {
    return null;
  }
  const relative = normalized.slice(rootNormalized.length + 1);
  const parts = relative.split("/");
  if (parts.length < 2) return null; // file at root, skip
  // Skip files inside our own /Processed output so we do not loop.
  if (parts.some((p) => p.toLowerCase() === "processed")) return null;
  const subfolder = parts[0];
  const fileName = parts[parts.length - 1];
  return { subfolder, fileName };
}

async function getDropbox(creds: DropboxAutohdrCredentials) {
  return new Dropbox({ accessToken: creds.accessToken, fetch: fetch as any });
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

  const accountResult = await dbx.usersGetCurrentAccount();
  const accountId = (accountResult.result as any).account_id as string;

  const latest = await dbx.filesListFolderGetLatestCursor({
    path: creds.watchFolder,
    recursive: true,
    include_media_info: false,
    include_deleted: false,
    include_has_explicit_shared_members: false,
  });
  const cursor = (latest.result as any).cursor as string;

  const updated: DropboxAutohdrCredentials = {
    ...creds,
    accountId,
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

  // Group image files by subfolder (property name), skip non-images
  // and anything inside /Processed output.
  const grouped = new Map<string, Array<{ path: string; fileName: string }>>();
  let skipped = 0;
  for (const entry of newEntries) {
    const parsed = parseDropboxPath(entry.path, creds.watchFolder);
    if (!parsed || !isImage(parsed.fileName)) {
      skipped++;
      continue;
    }
    const arr = grouped.get(parsed.subfolder) ?? [];
    arr.push({ path: entry.path, fileName: parsed.fileName });
    grouped.set(parsed.subfolder, arr);
  }

  let totalIngested = 0;
  let totalProperties = 0;

  const entries = Array.from(grouped.entries());
  for (const [subfolder, files] of entries) {
    const sourceFolder = `${creds.watchFolder.replace(/\/$/, "")}/${subfolder}`;

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
          address: subfolder,
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

      // Download from Dropbox, upload to S3.
      const downloadRes = (await dbx.filesDownload({ path: f.path })) as any;
      const fileBinary: Buffer = downloadRes.result.fileBinary
        ? Buffer.from(downloadRes.result.fileBinary)
        : Buffer.from(await (downloadRes.result.fileBlob as Blob).arrayBuffer());
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

    const outputBase =
      creds.outputBehavior === "outbox_folder"
        ? `${(creds.outputFolder ?? "/AutoQC Outbox").replace(/\/$/, "")}/${property.address}`
        : `${(property.dropboxSourceFolder ?? "").replace(/\/$/, "")}/Processed`;

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
        await dbx.filesUpload({
          path: `${outputBase}/${photo.fileName}`,
          contents: buf,
          mode: { ".tag": "overwrite" },
        });
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
