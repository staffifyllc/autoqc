import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/profiles - list style profiles
export async function GET() {
  try {
    const session = await requireAgency();

    const profiles = await prisma.styleProfile.findMany({
      where: { agencyId: session.user.agencyId },
      include: { _count: { select: { clients: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}

// POST /api/profiles - create style profile
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = await req.json();

    const profile = await prisma.styleProfile.create({
      data: {
        agencyId: session.user.agencyId!,
        name: body.name,
        isDefault: body.isDefault || false,
        verticalTolerance: body.verticalTolerance || 1.0,
        sharpnessThreshold: body.sharpnessThreshold || 100.0,
        referencePhotos: body.referencePhotos || [],
      },
    });

    // If this is marked as default, unset other defaults
    if (body.isDefault) {
      await prisma.styleProfile.updateMany({
        where: {
          agencyId: session.user.agencyId,
          id: { not: profile.id },
        },
        data: { isDefault: false },
      });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
