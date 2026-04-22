import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DEFAULT_PHOTO_SORT_ORDER,
  sanitizePhotoSortOrder,
} from "@/lib/photoSort";

// GET /api/agency/sort-order - returns the caller's agency sort config.
export async function GET() {
  try {
    const session = await requireAgency();
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { autoSortEnabled: true, photoSortOrder: true },
    });
    return NextResponse.json({
      autoSortEnabled: agency?.autoSortEnabled ?? false,
      photoSortOrder: sanitizePhotoSortOrder(
        agency?.photoSortOrder ?? DEFAULT_PHOTO_SORT_ORDER
      ),
      defaultOrder: DEFAULT_PHOTO_SORT_ORDER,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Failed to load" },
      { status: 500 }
    );
  }
}

// PATCH /api/agency/sort-order
// Body: { autoSortEnabled?: boolean, photoSortOrder?: string[] }
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = await req.json();

    const data: { autoSortEnabled?: boolean; photoSortOrder?: string[] } = {};
    if (typeof body.autoSortEnabled === "boolean") {
      data.autoSortEnabled = body.autoSortEnabled;
    }
    if (Array.isArray(body.photoSortOrder)) {
      data.photoSortOrder = sanitizePhotoSortOrder(body.photoSortOrder);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.agency.update({
      where: { id: session.user.agencyId! },
      data,
      select: { autoSortEnabled: true, photoSortOrder: true },
    });

    return NextResponse.json({
      autoSortEnabled: updated.autoSortEnabled,
      photoSortOrder: updated.photoSortOrder,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Failed to update" },
      { status: 500 }
    );
  }
}
