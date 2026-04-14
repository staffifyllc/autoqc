import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/profiles/[id]/learn - trigger style learning from reference photos
// This endpoint tells the QC engine to analyze reference photos and update the profile
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();

    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    if (!profile.referencePhotos.length) {
      return NextResponse.json(
        { error: "Upload reference photos first" },
        { status: 400 }
      );
    }

    // In production, this would enqueue a job to the Lambda
    // that analyzes all reference photos and computes the style parameters.
    // For now, we return a placeholder response.
    // The Lambda will call back to update the profile via an internal API.

    return NextResponse.json({
      status: "learning",
      message: `Analyzing ${profile.referencePhotos.length} reference photos. Profile will be updated when complete.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to start learning" },
      { status: 500 }
    );
  }
}
