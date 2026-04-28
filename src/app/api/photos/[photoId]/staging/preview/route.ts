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
      inspirationKey?: string;
      customPrompt?: string;
      // When set, lock furniture identity + position to a previously-
      // staged photo of the same room. Anchor must belong to the same
      // property as this photo (verified server-side).
      anchorPhotoId?: string;
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
      select: { isAdmin: true },
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

    // Pay-once-per-photo unlock model. The first staging interaction
    // on a photo charges 2 credits and sets stagingUnlockedAt. Every
    // subsequent preview on that photo (same style or any other style)
    // is free. Eliminates the "preview six styles, buy nothing" margin
    // drain — customer pays for access, then has the full toolkit.
    const effectiveCost = STAGING_CREDIT_COST;
    const isUnlocked = !!photo.stagingUnlockedAt;
    const photoForCharge = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { creditBalance: true, isAdmin: true },
    });
    if (!isUnlocked && !photoForCharge!.isAdmin) {
      if ((photoForCharge?.creditBalance ?? 0) < effectiveCost) {
        return NextResponse.json(
          {
            error: `Not enough credits. Unlocking Virtual Staging on a photo costs ${effectiveCost} credits ($${effectiveCost}).`,
            creditsNeeded: effectiveCost,
            creditsAvailable: photoForCharge?.creditBalance ?? 0,
          },
          { status: 402 }
        );
      }
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

    if (
      existing &&
      Date.now() - existing.createdAt.getTime() < PREVIEW_FRESH_MS &&
      isUnlocked
    ) {
      const url = await getDownloadUrl(existing.s3Key);
      return NextResponse.json({
        variant: existing,
        url,
        cached: true,
        creditCost: effectiveCost,
        unlocked: true,
      });
    }

    // Charge + unlock if first time on this photo. Done before generating
    // so a failed credit deduction does not waste the OpenAI render. We
    // refund inside the catch if the OpenAI call dies.
    let chargedThisCall = false;
    if (!isUnlocked && !photoForCharge!.isAdmin) {
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
      chargedThisCall = true;
    } else if (!isUnlocked && photoForCharge!.isAdmin) {
      // Admins bypass the charge but still get the unlock flag set.
      await prisma.photo.update({
        where: { id: photo.id },
        data: { stagingUnlockedAt: new Date() },
      });
    }

    // Source photo: prefer the auto-fixed version unless the user opted
    // back to original, matching Twilight behavior.
    const preferOriginal = photo.useOriginal || !photo.s3KeyFixed;
    const sourceKey = preferOriginal ? photo.s3KeyOriginal : photo.s3KeyFixed!;
    const sourceUrl = await getDownloadUrl(sourceKey);

    // Anchor mode: stage as a different angle of an already-staged
    // sibling photo. We resolve the anchor's most recent staged variant
    // (KEEPER preferred, else PREVIEW) and use it as the second source
    // image. Manifest comes from the anchor photo's stored manifest, or
    // is generated lazily right now if it's missing.
    let anchorImageUrl: string | undefined;
    let anchorManifest: string | undefined;
    if (body.anchorPhotoId && body.anchorPhotoId !== photo.id) {
      const anchor = await prisma.photo.findFirst({
        where: {
          id: body.anchorPhotoId,
          propertyId: photo.propertyId,
        },
        include: {
          variants: {
            where: {
              type: { in: ["STAGING_FINAL", "STAGING_PREVIEW"] },
              status: "READY",
            },
            orderBy: [
              // Prefer keeper over preview, then most recent.
              { type: "asc" }, // STAGING_FINAL < STAGING_PREVIEW alphabetically
              { createdAt: "desc" },
            ],
            take: 1,
          },
        },
      });
      if (anchor && anchor.variants.length > 0) {
        const v = anchor.variants[0];
        anchorImageUrl = await getDownloadUrl(v.s3Key);
        anchorManifest = anchor.stagingSpatialManifest ?? undefined;
        // Lazy-generate the manifest if the anchor was staged before
        // this feature shipped.
        if (!anchorManifest) {
          try {
            anchorManifest = await buildSpatialManifest({ imageUrl: anchorImageUrl });
            await prisma.photo.update({
              where: { id: anchor.id },
              data: { stagingSpatialManifest: anchorManifest },
            });
          } catch (e) {
            console.error("backfill anchor manifest failed:", e);
            // Soft-fail: still attach the image even if manifest gen
            // fails. Identity match still works, position match degrades
            // gracefully.
          }
        }
      }
    }

    // Inspiration + anchor are mutually exclusive at the OpenAI call
    // level (only one second image). Anchor wins when both are present.
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

    let bytes: Buffer;
    let mimeType: string;
    try {
      const out = await openaiEditImage({
        sourceUrl,
        prompt,
        quality: "high",
        size: "1536x1024",
        inspirationUrl: secondImageUrl,
      });
      bytes = out.bytes;
      mimeType = out.mimeType;
    } catch (genErr) {
      // OpenAI failed — refund the unlock charge so the customer is not
      // out two credits with nothing to show.
      if (chargedThisCall) {
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
              description: `Refund: Virtual Staging unlock failed on ${photo.fileName}`,
            },
          }),
          prisma.photo.update({
            where: { id: photo.id },
            data: { stagingUnlockedAt: null },
          }),
        ]);
      }
      throw genErr;
    }

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
        provider: "openai-gpt-image-1",
        prompt,
        status: "READY",
        creditCost: 0,
      },
    });

    // Persist the anchor relationship if this was a "match the anchor"
    // render. Lets the dashboard display "this angle matches angle #X"
    // and prevents accidental anchor flips on subsequent re-renders.
    if (useAnchor && body.anchorPhotoId) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: { stagingAnchorPhotoId: body.anchorPhotoId },
      });
    }

    // Generate the spatial manifest for THIS staged result if we don't
    // already have one for this photo. Future angles that pick this
    // photo as anchor will pull from this stored manifest. One Vision
    // call per photo, not per render — cheap, idempotent, and fire-and-
    // forget so it doesn't slow the response.
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
      cached: false,
      creditCost: effectiveCost,
      unlocked: true,
      chargedThisCall,
      anchorMatched: useAnchor,
    });
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
