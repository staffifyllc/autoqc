import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stagingEnabledForUser } from "@/lib/staging";

// GET /api/staging/eligibility
// Lightweight check the StagingButton uses to decide whether to render
// itself. Returns true when the env flag is on for everyone, or when
// the caller's agency is flagged isAdmin (closed-beta access). Server-
// side is the source of truth — the staging POST routes enforce the
// same gate, so this can never grant access the server would deny.
export async function GET() {
  try {
    const session = await requireAgency();
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { isAdmin: true },
    });
    const eligible = stagingEnabledForUser({
      isAdmin: !!agency?.isAdmin,
    });
    return NextResponse.json({ eligible });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ eligible: false }, { status: 401 });
    }
    return NextResponse.json({ eligible: false }, { status: 500 });
  }
}
