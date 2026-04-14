import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pushToAryeo } from "@/lib/integrations/aryeo";
import { pushToHDPhotoHub } from "@/lib/integrations/hdphotohub";
import { pushToDropbox } from "@/lib/integrations/dropbox";
import { getDownloadUrl } from "@/lib/s3";

// POST /api/integrations/push - push approved photos to delivery platform
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { propertyId, platform } = await req.json();

    // Get property with approved photos
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        agencyId: session.user.agencyId,
        status: "APPROVED",
      },
      include: {
        photos: {
          where: {
            status: { in: ["PASSED", "FIXED", "APPROVED"] },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found or not approved" },
        { status: 404 }
      );
    }

    // Get integration credentials
    const integration = await prisma.integration.findFirst({
      where: {
        agencyId: session.user.agencyId,
        platform,
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: `${platform} integration not connected` },
        { status: 400 }
      );
    }

    // Get signed URLs for all approved photos (use fixed version if available)
    const photoUrls = await Promise.all(
      property.photos.map(async (photo) => {
        const key = photo.s3KeyFixed || photo.s3KeyOriginal;
        const url = await getDownloadUrl(key);
        return { fileName: photo.fileName, url, key };
      })
    );

    const credentials = integration.credentials as Record<string, string>;

    // Push to the appropriate platform
    let result;
    switch (platform) {
      case "ARYEO":
        result = await pushToAryeo(credentials, property.address, photoUrls);
        break;
      case "HDPHOTOHUB":
        result = await pushToHDPhotoHub(credentials, property.address, photoUrls);
        break;
      case "SPIRO":
      case "TONOMO":
        result = await pushToDropbox(
          credentials,
          platform.toLowerCase(),
          property.address,
          photoUrls
        );
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported platform" },
          { status: 400 }
        );
    }

    // Update property status
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        status: "PUSHED",
        pushedAt: new Date(),
        pushedTo: platform,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Push error:", error);
    return NextResponse.json(
      { error: "Failed to push photos" },
      { status: 500 }
    );
  }
}
