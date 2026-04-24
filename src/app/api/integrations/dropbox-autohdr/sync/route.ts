import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import {
  ingestAgencyDropbox,
  pushCompletedProperties,
} from "@/lib/integrations/dropboxAutohdr";

// Manual trigger of the same ingest + push-back flow the cron runs.
// Useful for testing and for the "Sync now" button in the settings UI.
export async function POST() {
  try {
    const session = await requireAgency();
    const ingest = await ingestAgencyDropbox({
      agencyId: session.user.agencyId!,
    });
    const push = await pushCompletedProperties({
      agencyId: session.user.agencyId!,
    });
    return NextResponse.json({ ingest, push });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[dropbox-autohdr sync]", e);
    return NextResponse.json(
      { error: e?.message ?? "Sync failed" },
      { status: 500 }
    );
  }
}
