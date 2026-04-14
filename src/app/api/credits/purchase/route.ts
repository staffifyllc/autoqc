import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { createCreditPurchaseSession } from "@/lib/credits";

// POST /api/credits/purchase - create Stripe checkout session for credits
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { packageId } = await req.json();

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID required" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const checkoutSession = await createCreditPurchaseSession(
      session.user.agencyId!,
      packageId,
      `${baseUrl}/dashboard/credits?success=true`,
      `${baseUrl}/dashboard/credits?canceled=true`
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("Purchase error:", error);
    return NextResponse.json(
      { error: error.message || "Purchase failed" },
      { status: 500 }
    );
  }
}
