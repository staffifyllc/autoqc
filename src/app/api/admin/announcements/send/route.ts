import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import { renderWhatsNewEmail, WHATS_NEW_SUBJECT } from "@/lib/announcements/whatsNew";
import { signUnsubscribeToken } from "@/lib/announcements/unsubscribeToken";

// POST /api/admin/announcements/send
// Admin-only. Two modes:
//   - mode: "test"  -> send to the calling admin only
//   - mode: "all"   -> send to every user with marketingOptIn = true
//
// The loop is serial with a short delay between sends so Resend does
// not reject on burst. For our current user volume this finishes in
// under a minute. The route runs synchronously and returns send stats
// when it finishes.

async function isAdmin(userId: string): Promise<boolean> {
  const membership = await prisma.agencyMember.findFirst({
    where: { userId },
    select: { agency: { select: { isAdmin: true } } },
  });
  return !!membership?.agency.isAdmin;
}

const SEND_DELAY_MS = 150;

function siteUrlFrom(req: NextRequest): string {
  return req.nextUrl.origin.includes("localhost")
    ? "https://www.autoqc.io"
    : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "test" | "all" = body?.mode === "all" ? "all" : "test";
    const siteUrl = siteUrlFrom(req);

    let recipients: Array<{ id: string; email: string; name: string | null }>;

    if (mode === "test") {
      const me = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, name: true },
      });
      if (!me?.email) {
        return NextResponse.json(
          { error: "Your account has no email on file." },
          { status: 400 }
        );
      }
      recipients = [me];
    } else {
      recipients = await prisma.user.findMany({
        where: { marketingOptIn: true, email: { not: "" } },
        select: { id: true, email: true, name: true },
      });
    }

    let sent = 0;
    let failed = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (const r of recipients) {
      const token = signUnsubscribeToken(r.id);
      const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${token}`;
      const { html, text } = renderWhatsNewEmail({
        recipientName: r.name,
        unsubscribeUrl,
        siteUrl,
      });
      const result = await sendEmail({
        to: r.email,
        subject: WHATS_NEW_SUBJECT,
        html,
        text,
      });
      if (result.error) {
        failed++;
        failures.push({ email: r.email, error: result.error });
      } else {
        sent++;
      }
      if (recipients.length > 1) {
        await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
      }
    }

    return NextResponse.json({
      mode,
      attempted: recipients.length,
      sent,
      failed,
      failures: failures.slice(0, 25),
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("announce send error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Send failed" },
      { status: 500 }
    );
  }
}
