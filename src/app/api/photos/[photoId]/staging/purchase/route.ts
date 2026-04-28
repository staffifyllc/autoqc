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
import { buildSpatialManifest } from "@/lib/stagingManifest";

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
      customPrompt?: string;
      anchorPhotoId?: string;
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

    // Flat $2 unlock per photo, charged on the first preview. By the
    // time the user hits "Keep" we should already be unlocked, so this
    // route mostly skips the charge. The charge fallback below only
    // fires if a client somehow hits Keep without ever calling preview.
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

    // Skip the credit charge entirely if this photo was already
    // unlocked by a prior preview call. The flat $2 unlock model
    // charges once per photo at the first preview; "Keep" is free
    // after that.
    const isUnlocked = !!photo.stagingUnlockedAt;
    let chargedHere = false;
    if (!isUnlocked && !agency.isAdmin) {
      if (agency.creditBalance < effectiveCost) {
        return NextResponse.json(
          {
            error: `Not enough credits. Virtual Staging costs ${effectiveCost} credits ($${effectiveCost}).`,
            creditsNeeded: effectiveCost,
            creditsAvailable: agency.creditBalance,
          },
          { status: 402 }
        );
      }
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
            description: `Virtual Staging unlock: ${photo.property.address} / ${photo.fileName}`,
          },
        }),
        prisma.photo.update({
          where: { id: photo.id },
          data: { stagingUnlockedAt: new Date() },
        }),
      ]);
      chargedHere = true;
    } else if (!isUnlocked && agency.isAdmin) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: { stagingUnlockedAt: new Date() },
      });
    }

    try {
      const preferOriginal = photo.useOriginal || !photo.s3KeyFixed;
      const sourceKey = preferOriginal
        ? photo.s3KeyOriginal
        : photo.s3KeyFixed!;
      const sourceUrl = await getDownloadUrl(sourceKey);

      // Anchor mode (same logic as preview route): pull the anchor's
      // staged variant + manifest and lock the new render to match.
      let anchorImageUrl: string | undefined;
      let anchorManifest: string | undefined;
      if (body.anchorPhotoId && body.anchorPhotoId !== photo.id) {
        const anchor = await prisma.photo.findFirst({
          where: { id: body.anchorPhotoId, propertyId: photo.propertyId },
          include: {
            variants: {
              where: {
                type: { in: ["STAGING_FINAL", "STAGING_PREVIEW"] },
                status: "READY",
              },
              orderBy: [{ type: "asc" }, { createdAt: "desc" }],
              take: 1,
            },
          },
        });
        if (anchor && anchor.variants.length > 0) {
          anchorImageUrl = await getDownloadUrl(anchor.variants[0].s3Key);
          anchorManifest = anchor.stagingSpatialManifest ?? undefined;
          if (!anchorManifest) {
            try {
              anchorManifest = await buildSpatialManifest({ imageUrl: anchorImageUrl });
              await prisma.photo.update({
                where: { id: anchor.id },
                data: { stagingSpatialManifest: anchorManifest },
              });
            } catch (e) {
              console.error("backfill anchor manifest failed:", e);
            }
          }
        }
      }
      const useAnchor = !!anchorImageUrl;
      const hasInspiration = !useAnchor && !!body.inspirationKey;
      const secondImageUrl = useAnchor
        ? anchorImageUrl
        : hasInspiration
          ? await getDownloadUrl(body.inspirationKey!)
          : undefined;

      const prompt = buildStagingPrompt({
        roomType,
        style,
        hasInspiration,
        anchorManifest: useAnchor ? anchorManifest : undefined,
        customPrompt: body.customPrompt,
      });
      const { bytes, mimeType } = await openaiEditImage({
        sourceUrl,
        prompt,
        quality: "high",
        size: "1536x1024",
        inspirationUrl: secondImageUrl,
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

      // Persist anchor relationship + lazy-write spatial manifest from
      // this staged result. See preview route for full rationale.
      if (useAnchor && body.anchorPhotoId) {
        await prisma.photo.update({
          where: { id: photo.id },
          data: { stagingAnchorPhotoId: body.anchorPhotoId },
        });
      }
      const downloadUrl = await getDownloadUrl(outKey);
      if (!photo.stagingSpatialManifest) {
        buildSpatialManifest({ imageUrl: downloadUrl })
          .then((manifest) =>
            prisma.photo.update({
              where: { id: photo.id },
              data: { stagingSpatialManifest: manifest },
            })
          )
          .catch((e) => console.error("manifest gen failed:", e));
      }
      return NextResponse.json({
        variant,
        url: downloadUrl,
        alreadyPurchased: false,
        anchorMatched: useAnchor,
      });
    } catch (genErr: any) {
      // Refund only if we charged on THIS call. If this photo was
      // already unlocked from a prior preview, there's nothing to
      // refund here — the original unlock charge stays on the books
      // because the user already received the preview render then.
      if (chargedHere) {
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
