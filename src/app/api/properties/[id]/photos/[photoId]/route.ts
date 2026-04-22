import { NextRequest, NextResponse } from "next/server";
import { PhotoStatus, Prisma } from "@prisma/client";
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

// PATCH - update photo status, or toggle useOriginal flag
// Body may include one or both of:
//   status: "APPROVED" | "REJECTED"
//   useOriginal: boolean  (true = serve original bytes, false = serve fixed)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await requireAgency();
    const body = await req.json();
    const { status, useOriginal } = body;

    if (status !== undefined && !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }
    if (useOriginal !== undefined && typeof useOriginal !== "boolean") {
      return NextResponse.json(
        { error: "useOriginal must be boolean" },
        { status: 400 }
      );
    }
    if (status === undefined && useOriginal === undefined) {
      return NextResponse.json(
        { error: "Pass status or useOriginal" },
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

    const data: Prisma.PhotoUpdateInput = {};
    if (status !== undefined) data.status = status as PhotoStatus;
    if (useOriginal !== undefined) data.useOriginal = useOriginal;

    const updated = await prisma.photo.update({
      where: { id: params.photoId },
      data,
    });

    // Check if all photos in property are now resolved (only when we
    // touched the status field).
    if (status !== undefined) {
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
