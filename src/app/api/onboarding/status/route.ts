import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/onboarding/status
// Returns booleans for each onboarding step. The Overview page renders
// a checklist from this. dismissed = caller hit "I'm good, hide this"
// on the checklist (stored in localStorage client-side, not here).
export async function GET() {
  try {
    const session = await requireAgency();
    const agencyId = session.user.agencyId!;

    const [profile, propertyCount, dropboxIntegration, anyStagingFinal, memberCount] =
      await Promise.all([
        prisma.styleProfile.findFirst({
          where: { agencyId, isDefault: true },
          select: {
            id: true,
            referencePhotos: true,
            colorTempAvg: true,
          },
        }),
        prisma.property.count({
          where: { agencyId, isStandaloneStaging: false },
        }),
        prisma.integration.findFirst({
          where: { agencyId, platform: "DROPBOX_AUTOHDR", isActive: true },
          select: { id: true },
        }),
        prisma.photoVariant.findFirst({
          where: {
            type: "STAGING_FINAL",
            photo: { property: { agencyId } },
          },
          select: { id: true },
        }),
        prisma.agencyMember.count({ where: { agencyId } }),
      ]);

    const refsCount = profile?.referencePhotos?.length ?? 0;
    const stylePhotosUploaded = refsCount >= 3;
    // Profile is "learned" once any of the analyzed columns has a value
    // (the Lambda fills colorTempAvg as part of its write).
    const profileLearned = profile?.colorTempAvg !== null && profile?.colorTempAvg !== undefined;

    return NextResponse.json({
      stylePhotosUploaded,
      stylePhotosCount: refsCount,
      profileLearned,
      firstProperty: propertyCount > 0,
      dropboxConnected: !!dropboxIntegration,
      stagingTried: !!anyStagingFinal,
      teamInvited: memberCount > 1,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[onboarding/status]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
