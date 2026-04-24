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
// Each customer creates their own Dropbox app, so each Integration row
// stores its own appSecret. To authorize a call we find the integration
// whose stored appSecret (a) verifies the HMAC signature AND (b) owns
// one of the account_ids Dropbox is notifying us about. This means a
// valid signature from app A can't trick us into processing agencies
// connected via app B.
function tryVerify(rawBody: string, secret: string, signature: string): boolean {
  if (!secret || !signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-dropbox-signature") ?? "";

    const body = JSON.parse(rawBody);
    const accountIds: string[] = body?.list_folder?.accounts ?? [];
    if (accountIds.length === 0) {
      return NextResponse.json({ ok: true, matched: 0 });
    }

    const integrations = await prisma.integration.findMany({
      where: {
        platform: "DROPBOX_AUTOHDR",
        isActive: true,
      },
    });

    const matched = integrations.filter((i) => {
      const creds = i.credentials as DropboxAutohdrCredentials;
      if (!creds.appSecret || !creds.accountId) return false;
      if (!accountIds.includes(creds.accountId)) return false;
      return tryVerify(rawBody, creds.appSecret, signature);
    });

    if (matched.length === 0) {
      console.warn("[dropbox-webhook] no integration passed signature + account check");
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

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
