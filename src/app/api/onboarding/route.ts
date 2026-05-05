import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordEvent } from "@/lib/events";

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
      // New agency gets a 5-credit welcome bonus so they can try the
      // product before pulling out a card. Bonus is PROMO type so it
      // does NOT inflate totalCreditsPurchased / the paying pill.
      const WELCOME_CREDITS = 5;
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
              description: `Welcome bonus: ${WELCOME_CREDITS} free credits`,
            },
          },
        },
      });
      agencyId = agency.id;

      // If this user came in through a ?ref=CODE link, signup recorded
      // a ReferralInvite with signedUpUserId set but no agency yet
      // (because the agency didn't exist). Link the agency now AND
      // grant the inviter their reward credits in the same transaction.
      // Reward only fires once per (inviter, invitee).
      const REFERRAL_REWARD = 25;
      try {
        const invite = await prisma.referralInvite.findFirst({
          where: { signedUpUserId: session.user.id, status: "SIGNED_UP" },
          include: { code: true },
        });
        if (invite && invite.creditedAt === null) {
          await prisma.$transaction([
            prisma.referralInvite.update({
              where: { id: invite.id },
              data: {
                signedUpAgencyId: agencyId,
                status: "CREDITED",
                creditedAt: new Date(),
                creditsEarned: REFERRAL_REWARD,
              },
            }),
            prisma.agency.update({
              where: { id: invite.code.agencyId },
              data: { creditBalance: { increment: REFERRAL_REWARD } },
            }),
            prisma.creditTransaction.create({
              data: {
                agencyId: invite.code.agencyId,
                type: "PROMO",
                amount: REFERRAL_REWARD,
                description: `Referral credit: ${invite.inviteeEmail} signed up`,
              },
            }),
            // Top up the new agency too so their welcome bundle reflects
            // the referral. They keep the 5-credit organic welcome plus
            // the 25-credit referral bonus = 30 total.
            prisma.agency.update({
              where: { id: agencyId },
              data: { creditBalance: { increment: REFERRAL_REWARD } },
            }),
            prisma.creditTransaction.create({
              data: {
                agencyId,
                type: "PROMO",
                amount: REFERRAL_REWARD,
                description: `Referral signup bonus: ${REFERRAL_REWARD} credits`,
              },
            }),
          ]);
        }
      } catch (refErr) {
        // Non-fatal: signup completes even if referral wiring blew up.
        console.error("[onboarding referral credit] non-fatal:", refErr);
      }
    }

    // Funnel event: onboarding complete. Fire-and-forget.
    void recordEvent({
      userId: session.user.id,
      agencyId,
      name: "signup_completed",
    });

    return NextResponse.json({ success: true, agencyId });
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: error.message || "Onboarding failed" },
      { status: 500 }
    );
  }
}
