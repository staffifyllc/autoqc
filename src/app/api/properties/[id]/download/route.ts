import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/s3";
import {
  sanitizePhotoSortOrder,
  sortPhotosByRoomType,
} from "@/lib/photoSort";

// GET /api/properties/[id]/download?which=approved|all|fixed
// Returns a list of signed URLs for bulk download.
// Client downloads each via the urls; for a true zip, this would
// need a zipping service - this is the simple direct-link approach.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const which = req.nextUrl.searchParams.get("which") || "approved";

    const property = await prisma.property.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      include: {
        photos: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    let photos = property.photos;
    if (which === "approved") {
      photos = photos.filter((p) =>
        ["PASSED", "FIXED", "APPROVED"].includes(p.status)
      );
    } else if (which === "fixed") {
      photos = photos.filter((p) => !!p.s3KeyFixed);
    }

    // Apply agency-level auto-sort so the ZIP ships photos in MLS order.
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { autoSortEnabled: true, photoSortOrder: true },
    });
    if (agency?.autoSortEnabled) {
      photos = sortPhotosByRoomType(
        photos,
        sanitizePhotoSortOrder(agency.photoSortOrder)
      );
    }

    const downloads = await Promise.all(
      photos.map(async (p) => {
        // Use fixed version when available UNLESS the user reverted this
        // photo to original. Fall back to original if no fix exists.
        const preferOriginal = p.useOriginal || !p.s3KeyFixed;
        const key = preferOriginal ? p.s3KeyOriginal : p.s3KeyFixed!;
        const url = await getDownloadUrl(key);
        return {
          fileName: p.fileName,
          status: p.status,
          isFixed: !preferOriginal,
          useOriginal: p.useOriginal,
          url,
        };
      })
    );

    return NextResponse.json({
      propertyAddress: property.address,
      count: downloads.length,
      downloads,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Download failed" },
      { status: 500 }
    );
  }
}
