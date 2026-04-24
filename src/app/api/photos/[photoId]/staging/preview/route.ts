import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { s3, BUCKET, getDownloadUrl } from "@/lib/s3";
import { geminiEditImage } from "@/lib/gemini";
import {
  buildStagingPrompt,
  ELIGIBLE_STAGING_ROOM_TYPES,
  stagingEnabledForUser,
  styleById,
  STAGING_CREDIT_COST,
  STAGING_STYLES,
  type StagingStyleId,
} from "@/lib/staging";

// 24h cache per (photoId, style). Flipping between styles regenerates.
const PREVIEW_FRESH_MS = 24 * 60 * 60 * 1000;

// POST /api/photos/[photoId]/staging/preview
// Body: { style: StagingStyleId, overrideRoomType?: string }
// Returns a free preview of the staged room. No credit charge.
export async function POST(
  req: NextRequest,
  { params }: { params: { photoId: string } }
) {
  try {
    const session = await requireAgency();

    const body = (await req.json().catch(() => ({}))) as {
      style?: string;
      overrideRoomType?: string;
    };
    const style = body.style as StagingStyleId | undefined;
    if (!style || !styleById(style)) {
      return NextResponse.json(
        { error: `style is required. Valid: ${STAGING_STYLES.map((s) => s.id).join(", ")}` },
        { status: 400 }
      );
    }

    // Feature gate: unless the env flag is on, only admin agencies see
    // this. Keeps real customers out while we validate quality.
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { isAdmin: true, stagingCreditCost: true },
    });
    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }
    if (!stagingEnabledForUser({ isAdmin: agency.isAdmin })) {
      return NextResponse.json(
        { error: "Virtual Staging is in closed beta. Contact us to enable it." },
        { status: 403 }
      );
    }

    const photo = await prisma.photo.findFirst({
      where: {
        id: params.photoId,
        property: { agencyId: session.user.agencyId },
      },
      include: { property: true },
    });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const classified = (photo.issues as any)?._room_type ?? null;
    const roomType = body.overrideRoomType ?? classified;
    if (!roomType || !ELIGIBLE_STAGING_ROOM_TYPES.has(roomType)) {
      return NextResponse.json(
        {
          error:
            "Virtual Staging works on living rooms, bedrooms, dining rooms, and offices. Use the room-type override if this photo was misclassified.",
          classifiedRoomType: classified,
        },
        { status: 400 }
      );
    }

    // Cached preview for this (photo, style) pair?
    const existing = await prisma.photoVariant.findFirst({
      where: {
        photoId: photo.id,
        type: "STAGING_PREVIEW",
        style,
        status: "READY",
      },
      orderBy: { createdAt: "desc" },
    });
    const effectiveCost = agency.stagingCreditCost ?? STAGING_CREDIT_COST;

    if (existing && Date.now() - existing.createdAt.getTime() < PREVIEW_FRESH_MS) {
      const url = await getDownloadUrl(existing.s3Key);
      return NextResponse.json({ variant: existing, url, cached: true, creditCost: effectiveCost });
    }

    // Source photo: prefer the auto-fixed version unless the user opted
    // back to original, matching Twilight behavior.
    const preferOriginal = photo.useOriginal || !photo.s3KeyFixed;
    const sourceKey = preferOriginal ? photo.s3KeyOriginal : photo.s3KeyFixed!;
    const sourceUrl = await getDownloadUrl(sourceKey);

    const prompt = buildStagingPrompt({ roomType, style });

    const { bytes, mimeType } = await geminiEditImage({
      sourceUrl,
      prompt,
    });

    const ext = mimeType.includes("png") ? "png" : "jpg";
    const outKey = `${session.user.agencyId}/${photo.propertyId}/staging/preview/${photo.id}-${style}-${Date.now()}.${ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: outKey,
        Body: bytes,
        ContentType: mimeType,
      })
    );

    const variant = await prisma.photoVariant.create({
      data: {
        photoId: photo.id,
        type: "STAGING_PREVIEW",
        style,
        s3Key: outKey,
        provider: "gemini",
        prompt,
        status: "READY",
        creditCost: 0,
      },
    });

    const url = await getDownloadUrl(outKey);
    return NextResponse.json({ variant, url, cached: false, creditCost: effectiveCost });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("staging preview error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Preview failed" },
      { status: 500 }
    );
  }
}
