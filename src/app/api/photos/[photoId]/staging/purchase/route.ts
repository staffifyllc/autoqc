import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { s3, BUCKET, getDownloadUrl } from "@/lib/s3";
import { openaiEditImage } from "@/lib/openai";
import {
  buildStagingPrompt,
  ELIGIBLE_STAGING_ROOM_TYPES,
  stagingEnabledForUser,
  styleById,
  STAGING_CREDIT_COST,
  STAGING_STYLES,
  type StagingStyleId,
} from "@/lib/staging";

// POST /api/photos/[photoId]/staging/purchase
// Body: { style: StagingStyleId, overrideRoomType?: string }
// Charges STAGING_CREDIT_COST (3) credits, generates a full-resolution
// staged render, stores it as a STAGING_FINAL variant.
export async function POST(
  req: NextRequest,
  { params }: { params: { photoId: string } }
) {
  try {
    const session = await requireAgency();

    const body = (await req.json().catch(() => ({}))) as {
      style?: string;
      overrideRoomType?: string;
      inspirationKey?: string;
    };
    const style = body.style as StagingStyleId | undefined;
    if (!style || !styleById(style)) {
      return NextResponse.json(
        { error: `style is required. Valid: ${STAGING_STYLES.map((s) => s.id).join(", ")}` },
        { status: 400 }
      );
    }

    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { creditBalance: true, isAdmin: true },
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

    // Flat across every agency. Per-agency overrides retired at
    // standardization on $2.
    const effectiveCost = STAGING_CREDIT_COST;

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
            "Virtual Staging works on living rooms, bedrooms, dining rooms, and offices.",
          classifiedRoomType: classified,
        },
        { status: 400 }
      );
    }

    // Short-circuit if a STAGING_FINAL already exists for this (photo, style).
    const already = await prisma.photoVariant.findFirst({
      where: {
        photoId: photo.id,
        type: "STAGING_FINAL",
        style,
        status: "READY",
      },
      orderBy: { createdAt: "desc" },
    });
    if (already) {
      const url = await getDownloadUrl(already.s3Key);
      return NextResponse.json({
        variant: already,
        url,
        alreadyPurchased: true,
      });
    }

    if (!agency.isAdmin && agency.creditBalance < effectiveCost) {
      return NextResponse.json(
        {
          error: `Not enough credits. Virtual Staging costs ${effectiveCost} credits.`,
          creditsNeeded: effectiveCost,
          creditsAvailable: agency.creditBalance,
        },
        { status: 402 }
      );
    }

    // Deduct + record before generating, refund on failure. Same pattern
    // as twilight/purchase.
    if (!agency.isAdmin) {
      await prisma.$transaction([
        prisma.agency.update({
          where: { id: session.user.agencyId! },
          data: { creditBalance: { decrement: effectiveCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            agencyId: session.user.agencyId!,
            type: "USAGE",
            amount: -effectiveCost,
            description: `Virtual Staging (${style}): ${photo.property.address} / ${photo.fileName}`,
          },
        }),
      ]);
    }

    try {
      const preferOriginal = photo.useOriginal || !photo.s3KeyFixed;
      const sourceKey = preferOriginal
        ? photo.s3KeyOriginal
        : photo.s3KeyFixed!;
      const sourceUrl = await getDownloadUrl(sourceKey);

      const hasInspiration = !!body.inspirationKey;
      const inspirationUrl = hasInspiration
        ? await getDownloadUrl(body.inspirationKey!)
        : undefined;

      const prompt = buildStagingPrompt({ roomType, style, hasInspiration });
      const { bytes, mimeType } = await openaiEditImage({
        sourceUrl,
        prompt,
        quality: "high",
        size: "1536x1024",
        inspirationUrl,
      });

      const ext = mimeType.includes("png") ? "png" : "jpg";
      const outKey = `${session.user.agencyId}/${photo.propertyId}/staging/final/${photo.id}-${style}-${Date.now()}.${ext}`;
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
          type: "STAGING_FINAL",
          style,
          s3Key: outKey,
          provider: "openai-gpt-image-1",
          prompt,
          status: "READY",
          creditCost: effectiveCost,
        },
      });

      const url = await getDownloadUrl(outKey);
      return NextResponse.json({ variant, url, alreadyPurchased: false });
    } catch (genErr: any) {
      if (!agency.isAdmin) {
        await prisma.$transaction([
          prisma.agency.update({
            where: { id: session.user.agencyId! },
            data: { creditBalance: { increment: effectiveCost } },
          }),
          prisma.creditTransaction.create({
            data: {
              agencyId: session.user.agencyId!,
              type: "REFUND",
              amount: effectiveCost,
              description: `Refund: Virtual Staging (${style}) failed on ${photo.fileName}`,
            },
          }),
        ]);
      }
      throw genErr;
    }
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("staging purchase error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Purchase failed" },
      { status: 500 }
    );
  }
}
