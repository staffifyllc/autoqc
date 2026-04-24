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
      finalsSubfolder: creds.finalsSubfolder ?? "04-Final-Photos",
      outputBehavior: creds.outputBehavior ?? "replace_in_place",
      outputFolder: creds.outputFolder ?? "/AutoQC Outbox",
      hasCursor: !!creds.cursor,
      hasAppSecret: !!creds.appSecret,
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
    const finalsSubfolder: string | undefined = body?.finalsSubfolder;
    const outputBehavior: string | undefined = body?.outputBehavior;
    const outputFolder: string | undefined = body?.outputFolder;
    const appSecret: string | undefined = body?.appSecret;

    if (!accessToken || !watchFolder) {
      return NextResponse.json(
        { error: "accessToken and watchFolder are required" },
        { status: 400 }
      );
    }
    if (
      outputBehavior &&
      outputBehavior !== "replace_in_place" &&
      outputBehavior !== "outbox_folder"
    ) {
      return NextResponse.json(
        { error: "outputBehavior must be replace_in_place or outbox_folder" },
        { status: 400 }
      );
    }

    // Preserve any existing appSecret/counters so a re-save (e.g. rotating
    // just the access token) doesn't wipe the secret we already have.
    const existing = await prisma.integration.findFirst({
      where: {
        agencyId: session.user.agencyId!,
        platform: "DROPBOX_AUTOHDR",
      },
    });
    const existingCreds = (existing?.credentials as DropboxAutohdrCredentials | null) ?? null;

    const creds: DropboxAutohdrCredentials = {
      accessToken,
      watchFolder,
      finalsSubfolder:
        finalsSubfolder && finalsSubfolder.trim().length > 0
          ? finalsSubfolder.trim()
          : existingCreds?.finalsSubfolder ?? "04-Final-Photos",
      outputBehavior:
        (outputBehavior as "replace_in_place" | "outbox_folder") ??
        "replace_in_place",
      outputFolder: outputFolder || "/AutoQC Outbox",
      appSecret: appSecret && appSecret.trim().length > 0
        ? appSecret.trim()
        : existingCreds?.appSecret,
      totalPhotosIngested: existingCreds?.totalPhotosIngested,
      totalPropertiesPushedBack: existingCreds?.totalPropertiesPushedBack,
      lastSyncedAt: existingCreds?.lastSyncedAt,
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
