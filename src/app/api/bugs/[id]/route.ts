import { NextRequest, NextResponse } from "next/server";
import { BugStatus, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

const SITE_URL = "https://www.autoqc.io";

async function isAdmin(userId: string): Promise<boolean> {
  const membership = await prisma.agencyMember.findFirst({
    where: { userId },
    select: { agency: { select: { isAdmin: true } } },
  });
  return !!membership?.agency.isAdmin;
}

// PATCH /api/bugs/[id]
// Admin-only. Update status, prUrl, internal notes. Sends a "bug fixed"
// email to the reporter when status transitions to FIXED.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const existing = await prisma.bugReport.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update: Prisma.BugReportUpdateInput = {};
    if (body.status !== undefined) {
      if (!["NEW", "TRIAGED", "IN_PROGRESS", "FIXED", "WONT_FIX"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      update.status = body.status as BugStatus;
      if (body.status === "FIXED" && !existing.resolvedAt) {
        update.resolvedAt = new Date();
      }
    }
    if (typeof body.prUrl === "string") {
      update.prUrl = body.prUrl.trim() || null;
    }
    if (typeof body.fixedCommitSha === "string") {
      update.fixedCommitSha = body.fixedCommitSha.trim() || null;
    }
    if (typeof body.internalNotes === "string") {
      update.internalNotes = body.internalNotes.trim() || null;
    }

    const updated = await prisma.bugReport.update({
      where: { id: params.id },
      data: update,
    });

    // Notify the reporter on three transitions:
    //   - NEW/TRIAGED/IN_PROGRESS -> TRIAGED (feature requests only):
    //     "we approved this idea, it is on the roadmap"
    //   - NEW/TRIAGED/IN_PROGRESS -> WONT_FIX: "we are not going to build this"
    //   - * -> FIXED: "your thing is live" (existing flow)
    //
    // The FIXED email stays below; the approval / won't-build emails
    // are the new short-form transitional ones.
    const wasResolved =
      existing.status === "FIXED" || existing.status === "WONT_FIX";

    if (
      update.status === "TRIAGED" &&
      existing.status !== "TRIAGED" &&
      !wasResolved &&
      existing.type === "FEATURE_REQUEST"
    ) {
      const reporter = await prisma.user.findUnique({
        where: { id: existing.reporterUserId },
        select: { name: true, email: true },
      });
      if (reporter?.email) {
        const firstName = reporter.name?.split(" ")[0] ?? "there";
        const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
            <div style="display:inline-block;background:#10c76c;color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:16px;">Approved</div>
            <h2 style="margin:0 0 12px 0;font-size:18px;">We like your idea — it is on the roadmap.</h2>
            <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;">
              Hey ${escapeHtml(firstName)} — thanks for suggesting this. We approved it for rollout and will email you again when it ships.
            </p>
            <div style="margin:20px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin-bottom:4px;">Your request</div>
              <div style="font-size:14px;font-weight:600;color:#111;">${escapeHtml(existing.title)}</div>
            </div>
          </div>
        </body></html>`;
        const text = `Hey ${firstName},

Thanks for suggesting "${existing.title}". We approved it for rollout and will email you again when it ships.
`;
        sendEmail({
          to: reporter.email,
          subject: `Approved: ${existing.title.slice(0, 80)}`,
          html,
          text,
        }).catch((err) =>
          console.error("reporter approval notify failed", err)
        );
      }
    }

    if (
      update.status === "WONT_FIX" &&
      existing.status !== "WONT_FIX" &&
      !wasResolved
    ) {
      const reporter = await prisma.user.findUnique({
        where: { id: existing.reporterUserId },
        select: { name: true, email: true },
      });
      if (reporter?.email) {
        const firstName = reporter.name?.split(" ")[0] ?? "there";
        const isFeature = existing.type === "FEATURE_REQUEST";
        const subjectPrefix = isFeature ? "Passed on" : "Closing";
        const headline = isFeature
          ? "We looked at your idea — passing on it for now."
          : "We reviewed your report — closing it.";
        const bodyCopy = isFeature
          ? `Hey ${escapeHtml(firstName)} — thanks for the suggestion. We read it carefully but are not going to build this right now. Feel free to reply if you want to know why.`
          : `Hey ${escapeHtml(firstName)} — we looked into this one and are closing it out. Reply if you think we got it wrong.`;
        const text = isFeature
          ? `Hey ${firstName},\n\nThanks for suggesting "${existing.title}". We read it carefully but are not going to build it right now. Reply if you want to know why.`
          : `Hey ${firstName},\n\nWe looked into "${existing.title}" and are closing it out. Reply if you think we got it wrong.`;
        const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
            <div style="display:inline-block;background:#6b7280;color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:16px;">${isFeature ? "Passed" : "Closed"}</div>
            <h2 style="margin:0 0 12px 0;font-size:18px;">${headline}</h2>
            <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;">
              ${bodyCopy}
            </p>
            <div style="margin:20px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin-bottom:4px;">Your ${isFeature ? "request" : "report"}</div>
              <div style="font-size:14px;font-weight:600;color:#111;">${escapeHtml(existing.title)}</div>
            </div>
          </div>
        </body></html>`;
        sendEmail({
          to: reporter.email,
          subject: `${subjectPrefix}: ${existing.title.slice(0, 80)}`,
          html,
          text,
        }).catch((err) =>
          console.error("reporter decline notify failed", err)
        );
      }
    }

    // Notify the reporter when their report is freshly marked FIXED.
    // Bug reports get "Fixed" framing. Feature requests get "Shipped".
    if (
      update.status === "FIXED" &&
      existing.status !== "FIXED"
    ) {
      const reporter = await prisma.user.findUnique({
        where: { id: existing.reporterUserId },
        select: { name: true, email: true },
      });
      if (reporter?.email) {
        const firstName =
          reporter.name?.split(" ")[0] ?? "there";
        const isFeature = existing.type === "FEATURE_REQUEST";
        const pillLabel = isFeature ? "Shipped" : "Fixed";
        const headline = isFeature
          ? "Your idea is live."
          : "Your bug report is live.";
        const bodyCopy = isFeature
          ? `Hey ${escapeHtml(firstName)} — the feature you requested has shipped to autoqc.io. Thanks for the idea.`
          : `Hey ${escapeHtml(firstName)} — the bug you reported has been fixed and deployed to autoqc.io. Thanks for flagging it.`;
        const subjectPrefix = isFeature ? "Shipped" : "Fixed";
        const textBody = isFeature
          ? `Hey ${firstName},\n\nThe feature you requested ("${existing.title}") has shipped to autoqc.io. Thanks for the idea.\n\nReply if it doesn't work the way you expected.`
          : `Hey ${firstName},\n\nThe bug you reported ("${existing.title}") has been fixed and deployed to autoqc.io. Thanks for flagging it.\n\nReply if it doesn't look right.`;

        const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
            <div style="display:inline-block;background:#10c76c;color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:16px;">${pillLabel}</div>
            <h2 style="margin:0 0 12px 0;font-size:18px;">${headline}</h2>
            <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;">
              ${bodyCopy}
            </p>
            <div style="margin:20px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin-bottom:4px;">Your ${isFeature ? "request" : "report"}</div>
              <div style="font-size:14px;font-weight:600;color:#111;">${escapeHtml(existing.title)}</div>
            </div>
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#10c76c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">Open AutoQC &rarr;</a>
            <p style="margin:20px 0 0 0;font-size:12px;color:#6b7280;">
              Reply to this email if it does not look right.
            </p>
          </div>
        </body></html>`;
        sendEmail({
          to: reporter.email,
          subject: `${subjectPrefix}: ${existing.title.slice(0, 80)}`,
          html,
          text: textBody,
        }).catch((err) =>
          console.error("reporter resolution notify failed", err)
        );
      }
    }

    return NextResponse.json({ bug: updated });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("bug update error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update." },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
