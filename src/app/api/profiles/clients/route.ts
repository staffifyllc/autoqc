import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/profiles/clients - list client profiles
export async function GET() {
  try {
    const session = await requireAgency();

    const clients = await prisma.clientProfile.findMany({
      where: { agencyId: session.user.agencyId },
      include: {
        styleProfile: { select: { name: true } },
        _count: { select: { properties: true } },
      },
      orderBy: { clientName: "asc" },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST /api/profiles/clients - create client profile
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = await req.json();

    const client = await prisma.clientProfile.create({
      data: {
        agencyId: session.user.agencyId!,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        styleProfileId: body.styleProfileId,
        colorTempOverride: body.colorTempOverride,
        saturationOverride: body.saturationOverride,
        contrastOverride: body.contrastOverride,
        exposureOverride: body.exposureOverride,
        verticalTolOverride: body.verticalTolOverride,
        customNotes: body.customNotes,
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}
