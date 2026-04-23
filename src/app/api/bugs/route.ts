import { NextRequest, NextResponse } from "next/server";
import { BugSeverity, FeedbackType, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

const ADMIN_NOTIFICATION_EMAIL = "pchareth@gmail.com";
const SITE_URL = "https://www.autoqc.io";

// POST /api/bugs - submit a bug report or feature request.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const type: FeedbackType =
      body.type === "FEATURE_REQUEST" ? "FEATURE_REQUEST" : "BUG";

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

    // Severity only matters for bugs. Feature requests always get NORMAL.
    let severity: BugSeverity = "NORMAL";
    if (
      type === "BUG" &&
      ["MINOR", "NORMAL", "CRITICAL"].includes(body.severity)
    ) {
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

    const membership = await prisma.agencyMember.findFirst({
      where: { userId: session.user.id },
      select: { agencyId: true },
    });

    const report = await prisma.bugReport.create({
      data: {
        reporterUserId: session.user.id,
        agencyId: membership?.agencyId,
        type,
        title,
        description,
        severity,
        screenshotKey,
        pageUrl,
        userAgent,
      },
    });

    const reporter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    const isBug = type === "BUG";
    const kindLabel = isBug ? `${severity} bug report` : "Feature request";
    const kindColor = isBug
      ? severity === "CRITICAL"
        ? "#dc2626"
        : "#6b7280"
      : "#10c76c";
    const emailSubject = isBug
      ? `[AutoQC bug · ${severity}] ${title.slice(0, 80)}`
      : `[AutoQC feature request] ${title.slice(0, 80)}`;

    const adminHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${kindColor};font-weight:700;margin-bottom:4px;">${kindLabel}</div>
        <h2 style="margin:0 0 12px 0;font-size:18px;">${escapeHtml(title)}</h2>
        <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(description)}</p>
        ${pageUrl ? `<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">Page: ${escapeHtml(pageUrl)}</p>` : ""}
        <p style="margin:0 0 16px 0;font-size:12px;color:#6b7280;">Reporter: ${escapeHtml(reporter?.name ?? "unknown")} &lt;${escapeHtml(reporter?.email ?? "")}&gt;</p>
        <a href="${SITE_URL}/dashboard/admin/bugs" style="display:inline-block;background:#10c76c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">Open in admin dashboard &rarr;</a>
      </div>
    </body></html>`;

    sendEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: emailSubject,
      html: adminHtml,
      text: `New ${kindLabel} from ${reporter?.email}.\n\n${title}\n\n${description}\n\nPage: ${pageUrl ?? "n/a"}\n\nTriage at ${SITE_URL}/dashboard/admin/bugs`,
    }).catch((err) => console.error("admin feedback notify failed", err));

    return NextResponse.json({ bug: report });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("feedback submit error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to submit." },
      { status: 500 }
    );
  }
}

// GET /api/bugs?scope=mine|all&type=BUG|FEATURE_REQUEST
// scope=mine: the caller's reports. scope=all: admin only, all reports.
// type filter is optional. When omitted, all types are returned.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
    const rawType = req.nextUrl.searchParams.get("type");
    const typeFilter: FeedbackType | undefined =
      rawType === "BUG" || rawType === "FEATURE_REQUEST" ? rawType : undefined;

    if (scope === "all") {
      const membership = await prisma.agencyMember.findFirst({
        where: { userId: session.user.id },
        select: { agency: { select: { isAdmin: true } } },
      });
      if (!membership?.agency.isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const bugs = await prisma.bugReport.findMany({
        where: typeFilter ? { type: typeFilter } : undefined,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
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

    const bugs = await prisma.bugReport.findMany({
      where: {
        reporterUserId: session.user.id,
        ...(typeFilter ? { type: typeFilter } : {}),
      },
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
