import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { s3, BUCKET, getDownloadUrl } from "@/lib/s3";
import { geminiEditImage, TWILIGHT_PROMPT } from "@/lib/gemini";

// Eligibility: only exterior room types. Interiors would not benefit.
const ELIGIBLE_ROOM_TYPES = new Set([
  "exterior_front",
  "exterior_back",
  "exterior_pool",
]);

// Cache previews for 24 hours so a customer flipping back and forth
// does not burn the Gemini free tier.
const PREVIEW_FRESH_MS = 24 * 60 * 60 * 1000;

// POST /api/photos/[photoId]/twilight/preview
// Returns a free preview of a virtual-twilight render. No credit charge.
// If a fresh preview already exists for this photo, that is returned
// instead of hitting Gemini again.
export async function POST(
  _req: NextRequest,
  { params }: { params: { photoId: string } }
) {
  try {
    const session = await requireAgency();

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

    const roomType =
      (photo.issues as any)?._room_type ?? null;
    if (!roomType || !ELIGIBLE_ROOM_TYPES.has(roomType)) {
      return NextResponse.json(
        {
          error:
            "Virtual twilight only runs on exterior photos. This photo is not classified as an exterior.",
        },
        { status: 400 }
      );
    }

    // Return the cached preview if still fresh.
    const existing = await prisma.photoVariant.findFirst({
      where: { photoId: photo.id, type: "TWILIGHT_PREVIEW", status: "READY" },
      orderBy: { createdAt: "desc" },
    });
    if (existing && Date.now() - existing.createdAt.getTime() < PREVIEW_FRESH_MS) {
      const url = await getDownloadUrl(existing.s3Key);
      return NextResponse.json({
        variant: existing,
        url,
        cached: true,
      });
    }

    // Generate. Source is the fixed version if it exists and the user
    // has not reverted, otherwise the original.
    const preferOriginal = photo.useOriginal || !photo.s3KeyFixed;
    const sourceKey = preferOriginal
      ? photo.s3KeyOriginal
      : photo.s3KeyFixed!;
    const sourceUrl = await getDownloadUrl(sourceKey);

    const { bytes, mimeType } = await geminiEditImage({
      sourceUrl,
      prompt: TWILIGHT_PROMPT,
    });

    const ext = mimeType.includes("png") ? "png" : "jpg";
    const outKey = `${session.user.agencyId}/${photo.propertyId}/twilight/preview/${photo.id}-${Date.now()}.${ext}`;
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
        type: "TWILIGHT_PREVIEW",
        s3Key: outKey,
        provider: "gemini",
        prompt: TWILIGHT_PROMPT,
        status: "READY",
        creditCost: 0,
      },
    });

    const url = await getDownloadUrl(outKey);
    return NextResponse.json({ variant, url, cached: false });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("twilight preview error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Preview failed" },
      { status: 500 }
    );
  }
}
