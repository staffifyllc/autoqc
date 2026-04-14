import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/s3";

// GET - get photo details with signed URLs
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await requireAgency();

    const photo = await prisma.photo.findFirst({
      where: {
        id: params.photoId,
        property: {
          id: params.id,
          agencyId: session.user.agencyId,
        },
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    const originalUrl = await getDownloadUrl(photo.s3KeyOriginal);
    const fixedUrl = photo.s3KeyFixed
      ? await getDownloadUrl(photo.s3KeyFixed)
      : null;

    return NextResponse.json({
      photo: {
        ...photo,
        originalUrl,
        fixedUrl,
      },
    });
  } catch (error) {
    console.error("Photo detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch photo" },
      { status: 500 }
    );
  }
}

// PATCH - update photo status (approve/reject)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await requireAgency();
    const { status } = await req.json();

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const photo = await prisma.photo.findFirst({
      where: {
        id: params.photoId,
        property: {
          id: params.id,
          agencyId: session.user.agencyId,
        },
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.photo.update({
      where: { id: params.photoId },
      data: { status },
    });

    // Check if all photos in property are now resolved
    const unresolved = await prisma.photo.count({
      where: {
        propertyId: params.id,
        status: { in: ["PENDING", "PROCESSING", "FLAGGED"] },
      },
    });

    if (unresolved === 0) {
      await prisma.property.update({
        where: { id: params.id },
        data: { status: "APPROVED" },
      });
    }

    return NextResponse.json({ photo: updated });
  } catch (error) {
    console.error("Photo update error:", error);
    return NextResponse.json(
      { error: "Failed to update photo" },
      { status: 500 }
    );
  }
}
