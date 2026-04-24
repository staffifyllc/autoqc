import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/integrations - list connected integrations
export async function GET() {
  try {
    const session = await requireAgency();

    const integrations = await prisma.integration.findMany({
      where: { agencyId: session.user.agencyId },
    });

    // Strip sensitive credentials from response
    const safe = integrations.map((i) => ({
      id: i.id,
      platform: i.platform,
      isActive: i.isActive,
      createdAt: i.createdAt,
      hasCredentials: !!i.credentials,
    }));

    return NextResponse.json({ integrations: safe });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// POST /api/integrations - connect a new integration
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { platform, credentials } = await req.json();

    const validPlatforms = ["ARYEO", "HDPHOTOHUB", "SPIRO", "TONOMO"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform" },
        { status: 400 }
      );
    }

    const integration = await prisma.integration.upsert({
      where: {
        agencyId_platform: {
          agencyId: session.user.agencyId!,
          platform,
        },
      },
      update: { credentials, isActive: true },
      create: {
        agencyId: session.user.agencyId!,
        platform,
        credentials,
        isActive: true,
      },
    });

    return NextResponse.json({
      integration: {
        id: integration.id,
        platform: integration.platform,
        isActive: integration.isActive,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to connect integration" },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations?platform=ARYEO - mark inactive (keeps row for history)
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAgency();
    const url = new URL(req.url);
    const platform = url.searchParams.get("platform");
    if (!platform) {
      return NextResponse.json(
        { error: "platform query param required" },
        { status: 400 }
      );
    }
    await prisma.integration.updateMany({
      where: { agencyId: session.user.agencyId!, platform: platform as any },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
