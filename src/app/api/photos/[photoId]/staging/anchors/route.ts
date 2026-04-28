import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/s3";

// GET /api/photos/[photoId]/staging/anchors
// Returns sibling photos in the same property that have already been
// staged successfully. Used by the staging modal to show a "Match
// staging from..." picker for multi-angle consistency.
//
// Sibling rules:
//   - Same propertyId
//   - Different photoId
//   - Has at least one STAGING_FINAL or STAGING_PREVIEW variant in
//     status READY
//   - Same room type if the calling photo has one classified
//     (relax: include other-typed siblings as fallback so the user
//     can still match if classification disagrees)

export async function GET(
  _req: NextRequest,
  { params }: { params: { photoId: string } }
) {
  try {
    const session = await requireAgency();

    const photo = await prisma.photo.findFirst({
      where: { id: params.photoId, property: { agencyId: session.user.agencyId } },
      select: {
        id: true,
        propertyId: true,
        issues: true,
      },
    });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const callingRoomType = (photo.issues as any)?._room_type ?? null;

    const siblings = await prisma.photo.findMany({
      where: {
        propertyId: photo.propertyId,
        id: { not: photo.id },
        variants: {
          some: {
            type: { in: ["STAGING_FINAL", "STAGING_PREVIEW"] },
            status: "READY",
          },
        },
      },
      select: {
        id: true,
        fileName: true,
        issues: true,
        stagingSpatialManifest: true,
        variants: {
          where: {
            type: { in: ["STAGING_FINAL", "STAGING_PREVIEW"] },
            status: "READY",
          },
          orderBy: [{ type: "asc" }, { createdAt: "desc" }],
          take: 1,
          select: { id: true, s3Key: true, style: true, type: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Score: same room-type beats different room-type, has manifest beats
    // missing manifest. Then keep upload order.
    const scored = await Promise.all(
      siblings.map(async (s) => {
        const roomType = (s.issues as any)?._room_type ?? null;
        const v = s.variants[0];
        const url = v ? await getDownloadUrl(v.s3Key).catch(() => null) : null;
        const sameRoom = !!callingRoomType && roomType === callingRoomType;
        return {
          photoId: s.id,
          fileName: s.fileName,
          roomType,
          sameRoom,
          hasManifest: !!s.stagingSpatialManifest,
          previewUrl: url,
          variantStyle: v?.style ?? null,
          variantType: v?.type ?? null,
        };
      })
    );

    scored.sort((a, b) => {
      if (a.sameRoom !== b.sameRoom) return a.sameRoom ? -1 : 1;
      if (a.hasManifest !== b.hasManifest) return a.hasManifest ? -1 : 1;
      return 0;
    });

    return NextResponse.json({
      callingRoomType,
      anchors: scored,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("staging anchors error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load anchors" },
      { status: 500 }
    );
  }
}
