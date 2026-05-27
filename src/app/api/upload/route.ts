import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUploadUrl, getS3Key } from "@/lib/s3";

interface FileSpec {
  name: string;
  type: string;
  size: number;
}

interface BracketSpec {
  // Logical scene name; only used to create the parent Photo.fileName.
  sceneName: string;
  // File names (must match entries in `files`) that belong to this
  // bracket set. Sorted from darkest to brightest exposure by the
  // client.
  files: string[];
  // The bracket whose S3 key becomes Photo.s3KeyOriginal — used as the
  // pre-merge preview thumbnail. Conventionally the middle-EV frame.
  thumbnailFile: string;
}

interface UploadRequestBody {
  propertyId: string;
  files: FileSpec[];
  // HDR mode. When present, brackets define how the flat `files` list
  // groups into scenes. One Photo row is created per bracket set with
  // bracketKeys populated; the Lambda runs the merge before QC.
  brackets?: BracketSpec[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = (await req.json()) as UploadRequestBody;
    const { propertyId, files, brackets } = body;

    if (!propertyId || !files?.length) {
      return NextResponse.json(
        { error: "propertyId and files are required" },
        { status: 400 }
      );
    }

    // Verify property belongs to agency
    const property = await prisma.property.findFirst({
      where: { id: propertyId, agencyId: session.user.agencyId },
      include: { agency: { select: { hdrMergeEnabled: true } } },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // HDR mode is gated per-agency. Reject brackets from agencies that
    // don't have hdrMergeEnabled — defense in depth in case the UI is
    // bypassed or a stale client sends bracket data.
    if (brackets && brackets.length > 0 && !property.agency.hdrMergeEnabled) {
      return NextResponse.json(
        { error: "HDR mode is not enabled for this agency" },
        { status: 403 }
      );
    }

    // Generate one presigned URL per file. In both modes, every file
    // gets its own S3 destination — the only difference is how Photo
    // rows are created (one per scene vs one per file).
    const fileUploads = await Promise.all(
      files.map(async (file) => {
        const s3Key = getS3Key(
          session.user.agencyId!,
          propertyId,
          file.name
        );
        const uploadUrl = await getUploadUrl(s3Key, file.type || "application/octet-stream");
        return { fileName: file.name, uploadUrl, s3Key };
      })
    );

    const fileByName = new Map(
      fileUploads.map((u) => [u.fileName, u])
    );

    const photoCreates: Array<{
      photoId: string;
      fileNames: string[];
    }> = [];

    if (brackets && brackets.length > 0) {
      // HDR mode: one Photo per bracket group. bracketKeys carries every
      // S3 key in the set. s3KeyOriginal points at the thumbnail frame
      // (middle EV by convention).
      for (const b of brackets) {
        if (!b.files.length) continue;
        const thumbnail = fileByName.get(b.thumbnailFile) ?? fileByName.get(b.files[0]);
        if (!thumbnail) continue;
        const bracketKeys = b.files
          .map((fn) => fileByName.get(fn)?.s3Key)
          .filter((k): k is string => Boolean(k));

        // Pick a stable, human-readable file name for the Photo row.
        // The dashboard uses fileName as the display label so the agent
        // can read "Scene_001 (5 brackets)" in the UI.
        const displayName = b.sceneName || thumbnail.fileName;

        const photo = await prisma.photo.create({
          data: {
            propertyId,
            fileName: displayName,
            s3KeyOriginal: thumbnail.s3Key,
            bracketKeys,
            // fileSize stores the bracket-set total so storage stats
            // stay accurate
            fileSize: b.files.reduce((acc, fn) => {
              const f = files.find((x) => x.name === fn);
              return acc + (f?.size ?? 0);
            }, 0),
          },
        });

        photoCreates.push({ photoId: photo.id, fileNames: b.files });
      }
    } else {
      // Standard mode: one Photo per file, unchanged behavior.
      for (const file of files) {
        const upload = fileByName.get(file.name);
        if (!upload) continue;
        const photo = await prisma.photo.create({
          data: {
            propertyId,
            fileName: file.name,
            s3KeyOriginal: upload.s3Key,
            fileSize: file.size,
          },
        });
        photoCreates.push({ photoId: photo.id, fileNames: [file.name] });
      }
    }

    // Build the response per file: each file knows which Photo row it
    // belongs to (so the client can mark progress per Photo, not per
    // bracket frame).
    const fileNameToPhotoId = new Map<string, string>();
    for (const pc of photoCreates) {
      for (const fn of pc.fileNames) {
        fileNameToPhotoId.set(fn, pc.photoId);
      }
    }

    const uploads = fileUploads.map((u) => ({
      photoId: fileNameToPhotoId.get(u.fileName) ?? null,
      fileName: u.fileName,
      uploadUrl: u.uploadUrl,
      s3Key: u.s3Key,
    }));

    // Update property photo count. In HDR mode the visible count is
    // the number of finished scenes (Photo rows), not the bracket
    // file count.
    await prisma.property.update({
      where: { id: propertyId },
      data: { photoCount: { increment: photoCreates.length } },
    });

    return NextResponse.json({ uploads, photoCount: photoCreates.length });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
