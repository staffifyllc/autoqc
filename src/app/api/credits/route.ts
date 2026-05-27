import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { packagesForAgency } from "@/lib/credits";

// GET /api/credits - get credit balance and transaction history
export async function GET() {
  try {
    const session = await requireAgency();

    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId },
      select: {
        creditBalance: true,
        hasPaymentMethod: true,
        billingMode: true,
        totalCreditsPurchased: true,
        customCreditPriceCents: true,
        isStaffifyClient: true,
        hdrMergeEnabled: true,
      },
    });

    const transactions = await prisma.creditTransaction.findMany({
      where: { agencyId: session.user.agencyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      balance: agency?.creditBalance || 0,
      hasPaymentMethod: agency?.hasPaymentMethod || false,
      billingMode: agency?.billingMode || "CREDITS",
      totalPurchased: agency?.totalCreditsPurchased || 0,
      // Effective per-credit price in cents if a partner override is in
      // play (null otherwise). Page uses this to render the right
      // headline price on the "Credits" summary card.
      customCreditPriceCents: agency?.customCreditPriceCents ?? null,
      // Staffify partner gets 50% off ($5/credit, $6/property PAYG)
      // unless they also have a hand-negotiated customCreditPriceCents.
      isStaffifyClient: agency?.isStaffifyClient ?? false,
      // Surfaces to the dashboard sidebar so the "Auto-Edit (HDR)"
      // nav item shows up only for agencies with the flag flipped
      // (currently Flylisted only).
      hdrMergeEnabled: agency?.hdrMergeEnabled ?? false,
      transactions,
      packages: packagesForAgency(
        agency?.customCreditPriceCents,
        agency?.isStaffifyClient,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
