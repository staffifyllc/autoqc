import { NextRequest, NextResponse } from "next/server";
import { BugSeverity, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

const ADMIN_NOTIFICATION_EMAIL = "pchareth@gmail.com";
const SITE_URL = "https://www.autoqc.io";

// POST /api/bugs - submit a bug report
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title || title.length > 180) {
      return NextResponse.json(
        { error: "Title is required and under 180 characters." },
        { status: 400 }
      );
    }
    if (!description || description.length > 5000) {
      return NextResponse.json(
        { error: "Description is required and under 5000 characters." },
        { status: 400 }
      );
    }

    let severity: BugSeverity = "NORMAL";
    if (["MINOR", "NORMAL", "CRITICAL"].includes(body.severity)) {
      severity = body.severity;
    }

    const screenshotKey =
      typeof body.screenshotKey === "string" && body.screenshotKey.length < 500
        ? body.screenshotKey
        : null;
    const pageUrl =
      typeof body.pageUrl === "string" && body.pageUrl.length < 500
        ? body.pageUrl
        : null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    // Attach agencyId if the user has one.
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: session.user.id },
      select: { agencyId: true },
    });

    const report = await prisma.bugReport.create({
      data: {
        reporterUserId: session.user.id,
        agencyId: membership?.agencyId,
        title,
        description,
        severity,
        screenshotKey,
        pageUrl,
        userAgent,
      },
    });

    // Fire-and-forget notification to the admin. We do not await the email
    // because a Resend hiccup should not fail the bug submit.
    const reporter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    const adminHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${severity === "CRITICAL" ? "#dc2626" : "#6b7280"};font-weight:700;margin-bottom:4px;">${severity} bug report</div>
        <h2 style="margin:0 0 12px 0;font-size:18px;">${escapeHtml(title)}</h2>
        <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(description)}</p>
        ${pageUrl ? `<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">Page: ${escapeHtml(pageUrl)}</p>` : ""}
        <p style="margin:0 0 16px 0;font-size:12px;color:#6b7280;">Reporter: ${escapeHtml(reporter?.name ?? "unknown")} &lt;${escapeHtml(reporter?.email ?? "")}&gt;</p>
        <a href="${SITE_URL}/dashboard/admin/bugs" style="display:inline-block;background:#10c76c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">Open in admin dashboard &rarr;</a>
      </div>
    </body></html>`;

    sendEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `[AutoQC bug · ${severity}] ${title.slice(0, 80)}`,
      html: adminHtml,
      text: `New ${severity} bug report from ${reporter?.email}.\n\n${title}\n\n${description}\n\nPage: ${pageUrl ?? "n/a"}\n\nTriage at ${SITE_URL}/dashboard/admin/bugs`,
    }).catch((err) => console.error("admin bug notify failed", err));

    return NextResponse.json({ bug: report });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("bug report submit error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to submit." },
      { status: 500 }
    );
  }
}

// GET /api/bugs?scope=mine|all
// scope=mine: the caller's reports. scope=all: admin only, all reports.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";

    if (scope === "all") {
      const membership = await prisma.agencyMember.findFirst({
        where: { userId: session.user.id },
        select: { agency: { select: { isAdmin: true } } },
      });
      if (!membership?.agency.isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const bugs = await prisma.bugReport.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
      // Enrich with reporter info
      const reporterIds = Array.from(new Set(bugs.map((b) => b.reporterUserId)));
      const reporters = await prisma.user.findMany({
        where: { id: { in: reporterIds } },
        select: { id: true, name: true, email: true },
      });
      const reporterMap = Object.fromEntries(reporters.map((r) => [r.id, r]));
      return NextResponse.json({
        bugs: bugs.map((b) => ({ ...b, reporter: reporterMap[b.reporterUserId] ?? null })),
      });
    }

    // scope=mine (default)
    const bugs = await prisma.bugReport.findMany({
      where: { reporterUserId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ bugs });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch." },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
