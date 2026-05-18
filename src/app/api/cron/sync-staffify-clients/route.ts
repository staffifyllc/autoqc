/**
 * Hourly sync: mirror Staffify's talent-console roster onto
 * Agency.isStaffifyClient. Additive (new clients pick up the discount)
 * AND removing (churned clients lose it), but respects
 * staffifyClientLockedManually so manual picker flips stay sticky.
 *
 * Auth: same Bearer CRON_SECRET pattern as other crons. Admins can
 * also trigger it from the dashboard "Sync now" button via the same
 * cookie-authenticated route - we check for admin session OR cron
 * secret so both paths work.
 *
 * Dry run: ?dryRun=1 returns what would change without writing.
 */
import { NextRequest, NextResponse } from "next/server";
import { syncStaffifyClientFlags } from "@/lib/staffify/syncFlags";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function isAdminCaller(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return false;
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { agencies: { select: { agency: { select: { isAdmin: true } } } } },
    });
    return Boolean(user?.agencies.some((m) => m.agency.isAdmin));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // Match the bug-triage / stuck-pending convention: when CRON_SECRET
  // is not set, allow any caller (Vercel's cron platform invokes it
  // directly from inside the deployment). When the secret IS set, the
  // bearer must match. Admin session cookie path is also accepted.
  if (expected && auth !== `Bearer ${expected}`) {
    const adminAuthed = await isAdminCaller();
    if (!adminAuthed) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    const result = await syncStaffifyClientFlags({ dryRun });
    return NextResponse.json({
      ok: true,
      dryRun,
      ...result,
    });
  } catch (err) {
    console.error("[cron/sync-staffify-clients]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}

// Same handler accessible via POST so the admin "Sync now" button can
// call it without cache concerns.
export const POST = GET;
