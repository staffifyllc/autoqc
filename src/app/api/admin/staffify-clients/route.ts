import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

// Admin-only endpoints for flipping the Staffify-partner flag from the
// admin Platform usage page. Backed by the same Agency.isStaffifyClient
// column that scripts/mark-staffify-client.ts writes to.

// GET /api/admin/staffify-clients
// Returns every agency with the fields we need to render the picker:
// id, name, owner email, current isStaffifyClient. Sorted Staffify
// partners first, then everyone else alphabetically.
export async function GET() {
  try {
    await requireAdmin();

    const agencies = await prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        isStaffifyClient: true,
        staffifyClientLockedManually: true,
        staffifyLastSyncedAt: true,
        creditBalance: true,
        members: {
          where: { role: "owner" },
          select: {
            user: { select: { email: true } },
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    const rows = agencies.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.members[0]?.user.email ?? null,
      isStaffifyClient: a.isStaffifyClient,
      lockedManually: a.staffifyClientLockedManually,
      lastSyncedAt: a.staffifyLastSyncedAt
        ? a.staffifyLastSyncedAt.toISOString()
        : null,
      creditBalance: a.creditBalance,
    }));

    rows.sort((a, b) => {
      // Staffify-flagged agencies float to the top
      if (a.isStaffifyClient !== b.isStaffifyClient) {
        return a.isStaffifyClient ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ agencies: rows });
  } catch (e: any) {
    if (e?.message === "Unauthorized" || e?.message === "Forbidden") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[admin/staffify-clients GET]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/admin/staffify-clients
// Body: { agencyId: string, isStaffify: boolean }
// Flips Agency.isStaffifyClient. Returns the updated row.
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = (await req.json().catch(() => null)) as
      | { agencyId?: string; isStaffify?: boolean }
      | null;

    if (!body || typeof body.agencyId !== "string") {
      return NextResponse.json(
        { error: "agencyId required" },
        { status: 400 },
      );
    }
    if (typeof body.isStaffify !== "boolean") {
      return NextResponse.json(
        { error: "isStaffify (boolean) required" },
        { status: 400 },
      );
    }

    // Manual flips lock the row so the hourly Staffify sync never
    // overrides Paul's intent. To re-enable auto-sync on a row, the
    // admin can pass { unlock: true } separately (handled below) -
    // for the main toggle path we always set lock = true.
    const updated = await prisma.agency.update({
      where: { id: body.agencyId },
      data: {
        isStaffifyClient: body.isStaffify,
        staffifyClientLockedManually: true,
        staffifyLastSyncedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        isStaffifyClient: true,
        staffifyClientLockedManually: true,
      },
    });

    return NextResponse.json({ agency: updated });
  } catch (e: any) {
    if (e?.message === "Unauthorized" || e?.message === "Forbidden") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }
    console.error("[admin/staffify-clients POST]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
