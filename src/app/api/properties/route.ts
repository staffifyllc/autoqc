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
      // Exclude staging-only sessions; they live under their own tab.
      where: { agencyId: session.user.agencyId, isStandaloneStaging: false },
      include: {
        client: { select: { clientName: true } },
        _count: { select: { photos: true } },
        // Only pull the lightweight status column for in-flight photos.
        // Used by the UI to compute a realistic ETA for PROCESSING rows.
        photos: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Summarize per-property progress so the client can render ETA without
    // needing to scan the photo list itself. photosRemaining = anything not
    // yet at a terminal status.
    const TERMINAL_PHOTO_STATUSES = new Set([
      "PASSED",
      "FIXED",
      "FLAGGED",
      "APPROVED",
      "REJECTED",
    ]);

    const enriched = properties.map((p) => {
      const total = p.photos.length;
      const done = p.photos.filter((ph) =>
        TERMINAL_PHOTO_STATUSES.has(ph.status),
      ).length;
      // Strip the photo list from the response so we are not shipping it
      // all to the client unnecessarily.
      const { photos, ...rest } = p;
      return {
        ...rest,
        photoCount: total,
        photosDone: done,
        photosRemaining: Math.max(0, total - done),
      };
    });

    return NextResponse.json({ properties: enriched });
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
