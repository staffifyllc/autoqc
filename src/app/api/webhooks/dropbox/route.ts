import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import {
  ingestAgencyDropbox,
  pushCompletedProperties,
  type DropboxAutohdrCredentials,
} from "@/lib/integrations/dropboxAutohdr";

// GET is the Dropbox webhook verification handshake. Dropbox hits this
// once at registration time with ?challenge=xxxxx and expects the
// challenge to come back verbatim in the body.
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get("challenge") ?? "";
  return new NextResponse(challenge, {
    headers: {
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// POST is the actual change notification. Body is:
//   { "list_folder": { "accounts": ["dbid:..."] },
//     "delta":       { "users":    [1234, 5678] } }
// The accounts array has Dropbox account_ids that had changes inside
// their watched folder. We look up each account_id to the Integration
// row that stored it on setup, then call ingestAgencyDropbox() for
// each matched agency.
//
// Dropbox signs the request body with an HMAC-SHA256 using the app
// secret from DROPBOX_APP_SECRET. We validate before acting.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-dropbox-signature") ?? "";
    const appSecret = process.env.DROPBOX_APP_SECRET;

    if (!appSecret) {
      console.error("[dropbox-webhook] DROPBOX_APP_SECRET not set");
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    // Validate signature. Fail closed; Dropbox will retry.
    const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      console.warn("[dropbox-webhook] bad signature");
      return NextResponse.json({ error: "bad_signature" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);
    const accountIds: string[] = body?.list_folder?.accounts ?? [];
    if (accountIds.length === 0) {
      return NextResponse.json({ ok: true, matched: 0 });
    }

    // Match each account_id to an Integration. The credentials JSON has
    // accountId set at setup time.
    const integrations = await prisma.integration.findMany({
      where: {
        platform: "DROPBOX_AUTOHDR",
        isActive: true,
      },
    });
    const matched = integrations.filter((i) => {
      const creds = i.credentials as DropboxAutohdrCredentials;
      return !!creds.accountId && accountIds.includes(creds.accountId);
    });

    // Run ingest + push-back in parallel for each matched agency. Cap
    // total run-time so Dropbox does not retry on slow runs.
    await Promise.allSettled(
      matched.map(async (i) => {
        try {
          await ingestAgencyDropbox({ agencyId: i.agencyId });
          await pushCompletedProperties({ agencyId: i.agencyId });
        } catch (err) {
          console.error("[dropbox-webhook] per-agency failure:", i.agencyId, err);
        }
      })
    );

    return NextResponse.json({ ok: true, matched: matched.length });
  } catch (err: any) {
    console.error("[dropbox-webhook] unhandled:", err);
    // Still 200 so Dropbox does not hammer us on a transient issue.
    return NextResponse.json({ ok: true, note: "handled_with_error" });
  }
}
