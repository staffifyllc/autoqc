import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/s3";
import { buildXMP } from "@/lib/xmp";

// GET /api/properties/[id]/xmp
// Returns a list of XMP sidecar contents + photo download URLs.
// Each XMP applies the AutoQC-recommended Lightroom adjustments to that photo.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();

    const property = await prisma.property.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      include: { photos: { orderBy: { createdAt: "asc" } } },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    const sidecars = await Promise.all(
      property.photos.map(async (photo) => {
        const issues = (photo.issues as any) || {};
        const fullAnalysis = issues._full_analysis || {};

        const xmpContent = buildXMP(
          fullAnalysis,
          photo.verticalDev,
          photo.horizonDev,
          {
            photoFileName: photo.fileName,
            qcScore: photo.qcScore || undefined,
          }
        );

        // Photo download URL (use original - user applies XMP in Lightroom)
        const photoUrl = await getDownloadUrl(photo.s3KeyOriginal);

        // XMP filename mirrors the photo (photo.jpg → photo.xmp)
        const xmpFileName = photo.fileName.replace(
          /\.(jpg|jpeg|png|webp|tiff|tif)$/i,
          ".xmp"
        );

        return {
          photoFileName: photo.fileName,
          xmpFileName,
          xmpContent,
          photoUrl,
          qcScore: photo.qcScore,
          status: photo.status,
        };
      })
    );

    return NextResponse.json({
      propertyAddress: property.address,
      photoCount: property.photos.length,
      sidecars,
      instructions:
        "Download each photo AND its matching .xmp file, put them in the same folder, then import into Lightroom. AutoQC adjustments apply automatically.",
    });
  } catch (error: any) {
    console.error("XMP download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed" },
      { status: 500 }
    );
  }
}
