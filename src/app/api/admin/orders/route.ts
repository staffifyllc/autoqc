import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

const ALLOWED_LIMITS = [25, 50, 100] as const;
type AllowedLimit = (typeof ALLOWED_LIMITS)[number];

function parseLimit(raw: string | null): AllowedLimit {
  const n = Number(raw);
  return (ALLOWED_LIMITS as readonly number[]).includes(n) ? (n as AllowedLimit) : 25;
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get("limit"));
    const page = parsePage(searchParams.get("page"));
    const skip = (page - 1) * limit;

    const [total, properties] = await Promise.all([
      prisma.property.count(),
      prisma.property.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          address: true,
          status: true,
          tier: true,
          photoCount: true,
          qcPassCount: true,
          qcFailCount: true,
          totalQcScore: true,
          pushedTo: true,
          pushedAt: true,
          createdAt: true,
          agency: { select: { name: true } },
          client: { select: { clientName: true } },
        },
      }),
    ]);

    const orders = properties.map((p) => ({
      id: p.id,
      address: p.address,
      agency: p.agency.name,
      client: p.client?.clientName ?? null,
      tier: p.tier,
      status: p.status,
      photoCount: p.photoCount,
      qcPassCount: p.qcPassCount,
      qcFailCount: p.qcFailCount,
      avgQcScore: p.totalQcScore,
      pushedTo: p.pushedTo,
      pushedAt: p.pushedAt,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    const status = message === "Unauthorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
