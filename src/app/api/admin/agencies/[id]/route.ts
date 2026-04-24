import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

// GET /api/admin/agencies/[id]
// Admin-only. Returns everything we know about a specific agency:
// signup-form fields on the agency + its members, credit balance,
// recent usage, and staging activity. Powers the admin profile drill-in.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const agency = await prisma.agency.findUnique({
      where: { id: params.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
                phone: true,
                role: true,
                referralSource: true,
                marketingOptIn: true,
                passwordSetAt: true,
                createdAt: true,
              },
            },
          },
        },
        _count: {
          select: { properties: true, creditTransactions: true },
        },
      },
    });

    if (!agency) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Recent credit transactions (most recent 20).
    const transactions = await prisma.creditTransaction.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        priceCents: true,
        createdAt: true,
      },
    });

    // Recent properties (most recent 10).
    const properties = await prisma.property.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        address: true,
        status: true,
        tier: true,
        createdAt: true,
        photoCount: true,
        qcPassCount: true,
        qcFailCount: true,
      },
    });

    // Staging activity just for this agency.
    const stagingVariants = await prisma.photoVariant.findMany({
      where: {
        type: { in: ["STAGING_PREVIEW", "STAGING_FINAL"] },
        photo: { property: { agencyId: agency.id } },
      },
      select: { type: true, style: true, createdAt: true },
    });
    let stagingPreviews = 0;
    let stagingFinals = 0;
    for (const v of stagingVariants) {
      if (v.type === "STAGING_PREVIEW") stagingPreviews++;
      else stagingFinals++;
    }

    return NextResponse.json({
      agency: {
        id: agency.id,
        name: agency.name,
        website: agency.website,
        phone: agency.phone,
        addressCity: agency.addressCity,
        addressState: agency.addressState,
        teamSize: agency.teamSize,
        propertiesMonth: agency.propertiesMonth,
        yearsInBusiness: agency.yearsInBusiness,
        serviceTypes: agency.serviceTypes,
        currentPlatforms: agency.currentPlatforms,
        creditBalance: agency.creditBalance,
        totalCreditsPurchased: agency.totalCreditsPurchased,
        hasPaymentMethod: agency.hasPaymentMethod,
        defaultTier: agency.defaultTier,
        billingMode: agency.billingMode,
        isAdmin: agency.isAdmin,
        onboardingComplete: agency.onboardingComplete,
        createdAt: agency.createdAt,
        updatedAt: agency.updatedAt,
        propertyCount: agency._count.properties,
        transactionCount: agency._count.creditTransactions,
      },
      members: agency.members.map((m) => ({
        role: m.role,
        // AgencyMember has no createdAt of its own; user.createdAt is the
        // only usable "joined on" signal since the signup flow creates
        // both in the same transaction.
        joinedAt: m.user.createdAt,
        user: m.user,
      })),
      transactions,
      properties,
      staging: {
        previews: stagingPreviews,
        finals: stagingFinals,
        conversionRate:
          stagingPreviews > 0 ? stagingFinals / stagingPreviews : 0,
      },
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized" || e?.message === "Forbidden") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[admin/agencies/:id]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
