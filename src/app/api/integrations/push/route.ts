import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pushToAryeo } from "@/lib/integrations/aryeo";
import { pushToHDPhotoHub } from "@/lib/integrations/hdphotohub";
import { pushToDropbox } from "@/lib/integrations/dropbox";
import { getDownloadUrl } from "@/lib/s3";
import {
  sanitizePhotoSortOrder,
  sortPhotosByRoomType,
} from "@/lib/photoSort";

// POST /api/integrations/push - push approved photos to delivery platform
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { propertyId, platform } = await req.json();

    // Get property with approved photos + their purchased twilight variants
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

    // Apply agency-level auto-sort so photos go to MLS in the right order.
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { autoSortEnabled: true, photoSortOrder: true },
    });
    const orderedPhotos = agency?.autoSortEnabled
      ? sortPhotosByRoomType(
          property.photos,
          sanitizePhotoSortOrder(agency.photoSortOrder)
        )
      : property.photos;

    // Get signed URLs for all approved photos. Respect the per-photo
    // useOriginal override so a reverted photo pushes the original bytes,
    // not the rejected auto-fix. Purchased twilight variants are pushed
    // alongside with a _twilight suffix so the MLS platform lists them
    // as a separate image.
    const photoUrls = (
      await Promise.all(
        orderedPhotos.map(async (photo) => {
          const preferOriginal = photo.useOriginal || !photo.s3KeyFixed;
          const key = preferOriginal ? photo.s3KeyOriginal : photo.s3KeyFixed!;
          const url = await getDownloadUrl(key);
          const out = [{ fileName: photo.fileName, url, key }];

          const twilight = (photo as any).variants?.[0];
          if (twilight) {
            const twilightUrl = await getDownloadUrl(twilight.s3Key);
            const dot = photo.fileName.lastIndexOf(".");
            const base =
              dot > 0 ? photo.fileName.slice(0, dot) : photo.fileName;
            const ext =
              dot > 0 ? photo.fileName.slice(dot) : ".jpg";
            out.push({
              fileName: `${base}_twilight${ext}`,
              url: twilightUrl,
              key: twilight.s3Key,
            });
          }
          return out;
        })
      )
    ).flat();

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
