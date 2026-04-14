import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueQCJob } from "@/lib/sqs";

// GET /api/properties - list properties for agency
export async function GET() {
  try {
    const session = await requireAgency();

    const properties = await prisma.property.findMany({
      where: { agencyId: session.user.agencyId },
      include: {
        client: { select: { clientName: true } },
        _count: { select: { photos: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("Properties error:", error);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

// POST /api/properties - create a new property
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { address, clientProfileId } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const property = await prisma.property.create({
      data: {
        agencyId: session.user.agencyId!,
        address,
        clientProfileId: clientProfileId || null,
      },
    });

    return NextResponse.json({ property });
  } catch (error) {
    console.error("Create property error:", error);
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}
