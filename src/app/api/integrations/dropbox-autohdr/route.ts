import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DropboxAutohdrCredentials } from "@/lib/integrations/dropboxAutohdr";
import { initializeCursor } from "@/lib/integrations/dropboxAutohdr";

// GET: return the agency's current Dropbox AutoHDR config (if any),
// stripping the access token so it never round-trips back to the UI.
export async function GET() {
  try {
    const session = await requireAgency();
    const integration = await prisma.integration.findFirst({
      where: { agencyId: session.user.agencyId!, platform: "DROPBOX_AUTOHDR" },
    });
    if (!integration) {
      return NextResponse.json({ connected: false });
    }
    const creds = integration.credentials as DropboxAutohdrCredentials;
    return NextResponse.json({
      connected: true,
      isActive: integration.isActive,
      watchFolder: creds.watchFolder,
      outputBehavior: creds.outputBehavior ?? "processed_subfolder",
      outputFolder: creds.outputFolder ?? "/AutoQC Outbox",
      hasCursor: !!creds.cursor,
      accountId: creds.accountId ?? null,
      lastSyncedAt: creds.lastSyncedAt ?? null,
      totalPhotosIngested: creds.totalPhotosIngested ?? 0,
      totalPropertiesPushedBack: creds.totalPropertiesPushedBack ?? 0,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[dropbox-autohdr GET]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST: save config. Body: { accessToken, watchFolder, outputBehavior,
// outputFolder? }. Creates or updates the integration and initializes
// the cursor so subsequent drops are picked up.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = await req.json();
    const accessToken: string | undefined = body?.accessToken;
    const watchFolder: string | undefined = body?.watchFolder;
    const outputBehavior: string | undefined = body?.outputBehavior;
    const outputFolder: string | undefined = body?.outputFolder;

    if (!accessToken || !watchFolder) {
      return NextResponse.json(
        { error: "accessToken and watchFolder are required" },
        { status: 400 }
      );
    }
    if (
      outputBehavior &&
      outputBehavior !== "processed_subfolder" &&
      outputBehavior !== "outbox_folder"
    ) {
      return NextResponse.json(
        { error: "outputBehavior must be processed_subfolder or outbox_folder" },
        { status: 400 }
      );
    }

    const creds: DropboxAutohdrCredentials = {
      accessToken,
      watchFolder,
      outputBehavior:
        (outputBehavior as "processed_subfolder" | "outbox_folder") ??
        "processed_subfolder",
      outputFolder: outputFolder || "/AutoQC Outbox",
    };

    const integration = await prisma.integration.upsert({
      where: {
        agencyId_platform: {
          agencyId: session.user.agencyId!,
          platform: "DROPBOX_AUTOHDR",
        },
      },
      update: {
        isActive: true,
        credentials: creds as any,
      },
      create: {
        agencyId: session.user.agencyId!,
        platform: "DROPBOX_AUTOHDR",
        isActive: true,
        credentials: creds as any,
      },
    });

    // Capture a cursor from the current state of the watched folder.
    // Anything dropped after this call will be picked up on next ingest.
    try {
      const { accountId } = await initializeCursor(integration.id);
      return NextResponse.json({ success: true, accountId });
    } catch (err: any) {
      console.error("[dropbox-autohdr cursor init]", err);
      return NextResponse.json(
        {
          success: true,
          warning: `Saved but cursor init failed: ${err?.message ?? "unknown"}. Check the access token and watch folder.`,
        },
        { status: 200 }
      );
    }
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[dropbox-autohdr POST]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to save" },
      { status: 500 }
    );
  }
}

// DELETE: disconnect the integration. Keeps the row but marks inactive
// so we have the history; a new connect replaces the credentials.
export async function DELETE() {
  try {
    const session = await requireAgency();
    await prisma.integration.updateMany({
      where: {
        agencyId: session.user.agencyId!,
        platform: "DROPBOX_AUTOHDR",
      },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
