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
      // Create new agency with 10 free welcome credits so every signup
      // can run a real property end to end without paying first. Logged
      // as a PROMO transaction so it shows up in the audit trail.
      const WELCOME_CREDITS = 10;
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
          creditBalance: WELCOME_CREDITS,
          members: {
            create: { userId: session.user.id, role: "owner" },
          },
          styleProfiles: {
            create: {
              name: body.styleProfileName || "Default Style",
              isDefault: true,
            },
          },
          creditTransactions: {
            create: {
              type: "PROMO",
              amount: WELCOME_CREDITS,
              description: "Welcome bonus: 10 free credits",
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
