import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ingestAgencyDropbox,
  pushCompletedProperties,
} from "@/lib/integrations/dropboxAutohdr";

// Safety-net cron. Vercel hits this on the schedule in vercel.json.
// Walks every active DROPBOX_AUTOHDR integration and runs the same
// ingest + push-back as the webhook. Catches any missed webhooks.
//
// Auth: Vercel crons set a CRON_SECRET header; we check it so random
// callers cannot force a sweep.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const integrations = await prisma.integration.findMany({
    where: { platform: "DROPBOX_AUTOHDR", isActive: true },
    select: { agencyId: true },
  });

  const results: Array<{ agencyId: string; ingested: number; propertiesPushed: number; error?: string }> = [];
  for (const i of integrations) {
    try {
      const ing = await ingestAgencyDropbox({ agencyId: i.agencyId });
      const push = await pushCompletedProperties({ agencyId: i.agencyId });
      results.push({
        agencyId: i.agencyId,
        ingested: ing.ingested,
        propertiesPushed: push.propertiesPushed,
      });
    } catch (err: any) {
      results.push({
        agencyId: i.agencyId,
        ingested: 0,
        propertiesPushed: 0,
        error: err?.message ?? "unknown",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
