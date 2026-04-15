import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  try {
    await requireAdmin();

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86_400_000);
    const d30 = new Date(now.getTime() - 30 * 86_400_000);

    // Totals
    const [
      totalAgencies,
      totalProperties,
      totalPhotos,
      propsLast7,
      propsLast30,
      signupsLast7,
      signupsLast30,
      revenueAgg,
      creditsAgg,
    ] = await Promise.all([
      prisma.agency.count(),
      prisma.property.count(),
      prisma.photo.count(),
      prisma.property.count({ where: { createdAt: { gte: d7 } } }),
      prisma.property.count({ where: { createdAt: { gte: d30 } } }),
      prisma.agency.count({ where: { createdAt: { gte: d7 } } }),
      prisma.agency.count({ where: { createdAt: { gte: d30 } } }),
      prisma.creditTransaction.aggregate({
        where: { type: "PURCHASE" },
        _sum: { priceCents: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { type: "PURCHASE" },
        _sum: { amount: true },
      }),
    ]);

    // Agencies with enough detail for a table row. Sort by last activity
    // (most recent property updatedAt, fallback to agency.updatedAt).
    const agencies = await prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        creditBalance: true,
        totalCreditsPurchased: true,
        billingMode: true,
        isAdmin: true,
        defaultTier: true,
        _count: {
          select: {
            properties: true,
            members: true,
          },
        },
        properties: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
        members: {
          take: 1,
          select: {
            user: {
              select: { email: true, name: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const rows = agencies.map((a) => {
      const lastProp = a.properties[0]?.updatedAt ?? null;
      const lastActive = lastProp && lastProp > a.updatedAt ? lastProp : a.updatedAt;
      const primaryMember = a.members[0]?.user ?? null;
      return {
        id: a.id,
        name: a.name,
        createdAt: a.createdAt,
        lastActive,
        propertyCount: a._count.properties,
        memberCount: a._count.members,
        creditBalance: a.creditBalance,
        totalCreditsPurchased: a.totalCreditsPurchased,
        billingMode: a.billingMode,
        defaultTier: a.defaultTier,
        isAdmin: a.isAdmin,
        primaryEmail: primaryMember?.email ?? null,
        primaryName: primaryMember?.name ?? null,
      };
    });

    // Active counts derived from row last-active timestamps
    const activeLast7 = rows.filter((r) => r.lastActive && r.lastActive >= d7).length;
    const activeLast30 = rows.filter((r) => r.lastActive && r.lastActive >= d30).length;

    // Recent activity feed: last 30 transactions + last 30 properties,
    // interleaved and sorted by time desc.
    const [recentTx, recentProps] = await Promise.all([
      prisma.creditTransaction.findMany({
        take: 30,
        orderBy: { createdAt: "desc" },
        include: { agency: { select: { name: true } } },
      }),
      prisma.property.findMany({
        take: 30,
        orderBy: { createdAt: "desc" },
        include: { agency: { select: { name: true } } },
      }),
    ]);

    const events = [
      ...recentTx.map((t) => ({
        kind: "transaction" as const,
        at: t.createdAt,
        agency: t.agency.name,
        detail:
          t.type === "PURCHASE"
            ? `bought ${t.amount} credits for $${(
                (t.priceCents ?? 0) / 100
              ).toFixed(2)}`
            : `${t.type.toLowerCase()} ${t.amount} credits`,
      })),
      ...recentProps.map((p) => ({
        kind: "property" as const,
        at: p.createdAt,
        agency: p.agency.name,
        detail: `created property "${p.address}"`,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 40);

    return NextResponse.json({
      stats: {
        totalAgencies,
        totalProperties,
        totalPhotos,
        propsLast7,
        propsLast30,
        signupsLast7,
        signupsLast30,
        activeLast7,
        activeLast30,
        revenueCents: revenueAgg._sum.priceCents ?? 0,
        creditsPurchased: creditsAgg._sum.amount ?? 0,
      },
      agencies: rows,
      events,
      generatedAt: now,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    const status = message === "Unauthorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
