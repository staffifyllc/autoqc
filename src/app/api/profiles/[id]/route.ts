import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/s3";

// GET /api/profiles/[id] - get profile with reference photo URLs
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      include: { _count: { select: { clients: true } } },
    });
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Generate signed thumbnail URLs for all reference photos
    const referencePhotosWithUrls = await Promise.all(
      profile.referencePhotos.map(async (key) => ({
        key,
        url: await getDownloadUrl(key).catch(() => null),
      }))
    );

    return NextResponse.json({
      profile: { ...profile, referencePhotosWithUrls },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed" },
      { status: 500 }
    );
  }
}

// PATCH /api/profiles/[id] - update profile fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const body = await req.json();

    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.styleProfile.update({
      where: { id: params.id },
      data: {
        name: body.name ?? profile.name,
        verticalTolerance: body.verticalTolerance ?? profile.verticalTolerance,
        sharpnessThreshold:
          body.sharpnessThreshold ?? profile.sharpnessThreshold,
        isDefault: body.isDefault ?? profile.isDefault,
      },
    });

    if (body.isDefault === true) {
      await prisma.styleProfile.updateMany({
        where: {
          agencyId: session.user.agencyId,
          id: { not: params.id },
        },
        data: { isDefault: false },
      });
    }

    return NextResponse.json({ profile: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed" },
      { status: 500 }
    );
  }
}
