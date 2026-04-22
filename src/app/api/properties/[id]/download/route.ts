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
          include: {
            variants: {
              where: { type: "TWILIGHT_FINAL", status: "READY" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
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

    const downloads: Array<{
      fileName: string;
      status: string;
      isFixed: boolean;
      useOriginal: boolean;
      url: string;
      kind?: "twilight";
    }> = [];

    for (const p of photos) {
      const preferOriginal = p.useOriginal || !p.s3KeyFixed;
      const key = preferOriginal ? p.s3KeyOriginal : p.s3KeyFixed!;
      const url = await getDownloadUrl(key);
      downloads.push({
        fileName: p.fileName,
        status: p.status,
        isFixed: !preferOriginal,
        useOriginal: p.useOriginal,
        url,
      });

      // If this photo has a purchased twilight, append it with a
      // _twilight suffix so it lands right next to the original in the
      // downloaded folder and is obvious at a glance.
      const twilight = p.variants?.[0];
      if (twilight) {
        const twilightUrl = await getDownloadUrl(twilight.s3Key);
        const dot = p.fileName.lastIndexOf(".");
        const base =
          dot > 0 ? p.fileName.slice(0, dot) : p.fileName;
        const ext =
          dot > 0 ? p.fileName.slice(dot) : ".jpg";
        downloads.push({
          fileName: `${base}_twilight${ext}`,
          status: p.status,
          isFixed: true,
          useOriginal: false,
          url: twilightUrl,
          kind: "twilight",
        });
      }
    }

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
