import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderWhatsNewEmail, WHATS_NEW_SUBJECT } from "@/lib/announcements/whatsNew";
import { signUnsubscribeToken } from "@/lib/announcements/unsubscribeToken";

// GET /api/admin/announcements/preview
// Admin-only. Returns the rendered HTML of the what's-new email plus
// metadata the admin dashboard uses (subject, eligible recipient count).

async function isAdmin(userId: string): Promise<boolean> {
  const membership = await prisma.agencyMember.findFirst({
    where: { userId },
    select: { agency: { select: { isAdmin: true } } },
  });
  return !!membership?.agency.isAdmin;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const siteUrl =
      req.nextUrl.origin.includes("localhost")
        ? "https://www.autoqc.io"
        : req.nextUrl.origin;

    // Preview uses a dummy token so the unsubscribe link looks real but
    // never fires against a real user. The actual send endpoint uses
    // per-recipient tokens.
    const dummyToken = signUnsubscribeToken("preview");
    const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${dummyToken}`;

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });
    const { html } = renderWhatsNewEmail({
      recipientName: me?.name ?? null,
      unsubscribeUrl,
      siteUrl,
    });

    const eligibleCount = await prisma.user.count({
      where: { marketingOptIn: true, email: { not: "" } },
    });

    // If the caller asked for raw HTML (iframe preview), return that.
    const format = req.nextUrl.searchParams.get("format");
    if (format === "html") {
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({
      subject: WHATS_NEW_SUBJECT,
      html,
      eligibleCount,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("announce preview error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Preview failed" },
      { status: 500 }
    );
  }
}
