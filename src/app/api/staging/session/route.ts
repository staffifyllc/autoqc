import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/staging/session
// Lists the agency's standalone staging sessions (each one is a
// Property row with isStandaloneStaging=true), newest first.
export async function GET() {
  try {
    const session = await requireAgency();
    const sessions = await prisma.property.findMany({
      where: {
        agencyId: session.user.agencyId,
        isStandaloneStaging: true,
      },
      include: {
        _count: { select: { photos: true } },
        photos: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const TERMINAL = new Set([
      "PASSED",
      "FIXED",
      "FLAGGED",
      "APPROVED",
      "REJECTED",
    ]);
    const enriched = sessions.map((p) => {
      const total = p.photos.length;
      const done = p.photos.filter((ph) => TERMINAL.has(ph.status)).length;
      const { photos, ...rest } = p;
      return {
        ...rest,
        photoCount: total,
        photosDone: done,
        photosRemaining: Math.max(0, total - done),
      };
    });

    return NextResponse.json({ sessions: enriched });
  } catch (error) {
    console.error("[staging/session GET] error:", error);
    return NextResponse.json(
      { error: "Failed to load staging sessions" },
      { status: 500 }
    );
  }
}

// POST /api/staging/session
// Creates a new standalone staging session (a Property row flagged with
// isStandaloneStaging=true). Returns the property id so the client can
// redirect into the existing /dashboard/properties/[id] upload flow.
// Reuses the QC pipeline for room_type classification; once classified,
// the Virtual Staging button lights up on eligible photos.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = await req.json().catch(() => ({}));
    const label: string | undefined = typeof body?.label === "string" ? body.label.trim() : undefined;

    const now = new Date();
    const prettyDate = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const prettyTime = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const address = label && label.length > 0
      ? label
      : `Virtual Staging · ${prettyDate}, ${prettyTime}`;

    const property = await prisma.property.create({
      data: {
        agencyId: session.user.agencyId!,
        address,
        tier: "STANDARD",
        isStandaloneStaging: true,
      },
    });

    return NextResponse.json({ property });
  } catch (error) {
    console.error("[staging/session POST] error:", error);
    return NextResponse.json(
      { error: "Failed to start session" },
      { status: 500 }
    );
  }
}
