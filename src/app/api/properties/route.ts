import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueQCJob } from "@/lib/sqs";
import {
  ALL_DISTRACTION_CATEGORIES,
  filterValidDistractionCategories,
} from "@/lib/distractionCategories";

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
    const body = await req.json();
    const { address, clientProfileId, tier, distractionCategories } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Pick tier from request OR agency default
    let propertyTier: "STANDARD" | "PREMIUM" = "STANDARD";
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { defaultTier: true, distractionCategoriesDefault: true },
    });

    if (tier === "PREMIUM" || tier === "STANDARD") {
      propertyTier = tier;
    } else {
      propertyTier = (agency?.defaultTier || "STANDARD") as
        | "STANDARD"
        | "PREMIUM";
    }

    // Pick distraction categories from request, else inherit agency default.
    // The check only runs when tier is PREMIUM, but the list is stored
    // regardless so a later tier upgrade picks up the preference.
    let finalDistractionCategories: string[];
    if (Array.isArray(distractionCategories)) {
      finalDistractionCategories = filterValidDistractionCategories(
        distractionCategories
      );
    } else {
      finalDistractionCategories = filterValidDistractionCategories(
        (agency?.distractionCategoriesDefault as string[] | undefined) || []
      );
    }

    const property = await prisma.property.create({
      data: {
        agencyId: session.user.agencyId!,
        address,
        clientProfileId: clientProfileId || null,
        tier: propertyTier,
        distractionCategories: finalDistractionCategories,
      },
    });

    return NextResponse.json({
      property,
      meta: {
        availableDistractionCategories: ALL_DISTRACTION_CATEGORIES,
      },
    });
  } catch (error) {
    console.error("Create property error:", error);
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}
