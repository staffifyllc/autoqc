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
      transactions,
      packages: packagesForAgency(agency?.customCreditPriceCents),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
