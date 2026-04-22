import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { s3, BUCKET, getDownloadUrl } from "@/lib/s3";
import { geminiEditImage, TWILIGHT_PROMPT } from "@/lib/gemini";

const TWILIGHT_CREDIT_COST = 1;

const ELIGIBLE_ROOM_TYPES = new Set([
  "exterior_front",
  "exterior_back",
  "exterior_pool",
]);

// POST /api/photos/[photoId]/twilight/purchase
// Charges 1 credit, generates a full-resolution twilight final, stores
// it as a PhotoVariant. Returns the purchased variant.
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

    const roomType = (photo.issues as any)?._room_type ?? null;
    if (!roomType || !ELIGIBLE_ROOM_TYPES.has(roomType)) {
      return NextResponse.json(
        { error: "Virtual twilight only runs on exterior photos." },
        { status: 400 }
      );
    }

    // Short-circuit if a TWILIGHT_FINAL already exists for this photo.
    const already = await prisma.photoVariant.findFirst({
      where: { photoId: photo.id, type: "TWILIGHT_FINAL", status: "READY" },
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

    // Check credits. Admin agencies bypass.
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { creditBalance: true, isAdmin: true },
    });
    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }
    if (!agency.isAdmin && agency.creditBalance < TWILIGHT_CREDIT_COST) {
      return NextResponse.json(
        {
          error: "Not enough credits. Virtual twilight costs 1 credit.",
          creditsNeeded: TWILIGHT_CREDIT_COST,
          creditsAvailable: agency.creditBalance,
        },
        { status: 402 }
      );
    }

    // Deduct the credit + record the transaction BEFORE calling Gemini
    // so the charge is committed even if generation fails partway. We
    // then refund if the generate/upload path throws.
    if (!agency.isAdmin) {
      await prisma.$transaction([
        prisma.agency.update({
          where: { id: session.user.agencyId! },
          data: { creditBalance: { decrement: TWILIGHT_CREDIT_COST } },
        }),
        prisma.creditTransaction.create({
          data: {
            agencyId: session.user.agencyId!,
            type: "USAGE",
            amount: -TWILIGHT_CREDIT_COST,
            description: `Virtual Twilight: ${photo.property.address} / ${photo.fileName}`,
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

      const { bytes, mimeType } = await geminiEditImage({
        sourceUrl,
        prompt: TWILIGHT_PROMPT,
      });

      const ext = mimeType.includes("png") ? "png" : "jpg";
      const outKey = `${session.user.agencyId}/${photo.propertyId}/twilight/final/${photo.id}-${Date.now()}.${ext}`;
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
          type: "TWILIGHT_FINAL",
          s3Key: outKey,
          provider: "gemini",
          prompt: TWILIGHT_PROMPT,
          status: "READY",
          creditCost: TWILIGHT_CREDIT_COST,
        },
      });

      const url = await getDownloadUrl(outKey);
      return NextResponse.json({ variant, url, alreadyPurchased: false });
    } catch (genErr: any) {
      // Refund on generation failure so users are not charged for
      // outages they did not cause.
      if (!agency.isAdmin) {
        await prisma.$transaction([
          prisma.agency.update({
            where: { id: session.user.agencyId! },
            data: { creditBalance: { increment: TWILIGHT_CREDIT_COST } },
          }),
          prisma.creditTransaction.create({
            data: {
              agencyId: session.user.agencyId!,
              type: "REFUND",
              amount: TWILIGHT_CREDIT_COST,
              description: `Refund: virtual twilight failed on ${photo.fileName}`,
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
    console.error("twilight purchase error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Purchase failed" },
      { status: 500 }
    );
  }
}
