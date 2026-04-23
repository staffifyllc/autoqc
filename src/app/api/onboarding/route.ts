import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/onboarding - complete the onboarding flow
// Creates or updates user profile + agency with full business data
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    // Update user profile
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        name:
          body.firstName && body.lastName
            ? `${body.firstName} ${body.lastName}`
            : body.firstName || body.lastName || undefined,
        phone: body.phone,
        role: body.role || "OWNER",
        referralSource: body.referralSource,
      },
    });

    // Find or create agency
    const existingMembership = await prisma.agencyMember.findFirst({
      where: { userId: session.user.id },
    });

    let agencyId: string;

    if (existingMembership) {
      // Update existing agency
      await prisma.agency.update({
        where: { id: existingMembership.agencyId },
        data: {
          name: body.agencyName,
          website: body.website,
          phone: body.agencyPhone || body.phone,
          addressCity: body.city,
          addressState: body.state,
          teamSize: body.teamSize,
          propertiesMonth: body.propertiesMonth,
          yearsInBusiness: body.yearsInBusiness,
          serviceTypes: body.serviceTypes || [],
          currentPlatforms: body.currentPlatforms || [],
          onboardingComplete: true,
        },
      });
      agencyId = existingMembership.agencyId;
    } else {
      // Create new agency with a zero credit balance. No welcome bonus.
      // Volume discounts on bulk packs (see src/lib/credits.ts) are the
      // incentive to buy, not a free-grant on signup.
      const agency = await prisma.agency.create({
        data: {
          name: body.agencyName,
          website: body.website,
          phone: body.agencyPhone || body.phone,
          addressCity: body.city,
          addressState: body.state,
          teamSize: body.teamSize,
          propertiesMonth: body.propertiesMonth,
          yearsInBusiness: body.yearsInBusiness,
          serviceTypes: body.serviceTypes || [],
          currentPlatforms: body.currentPlatforms || [],
          onboardingComplete: true,
          creditBalance: 0,
          members: {
            create: { userId: session.user.id, role: "owner" },
          },
          styleProfiles: {
            create: {
              name: body.styleProfileName || "Default Style",
              isDefault: true,
            },
          },
        },
      });
      agencyId = agency.id;
    }

    return NextResponse.json({ success: true, agencyId });
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: error.message || "Onboarding failed" },
      { status: 500 }
    );
  }
}
