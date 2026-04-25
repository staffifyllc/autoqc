import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.autoqc.io";
const REWARD = 25;

// POST /api/referrals/invite
// Body: { emails: string[] }
// Creates / refreshes ReferralInvite rows for each new email and sends
// a friendly invite from the caller. Skips emails that already have an
// AutoQC account or that this code already invited.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const body = await req.json();
    const raw = (body?.emails ?? []) as string[];
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "emails (array) required" },
        { status: 400 }
      );
    }
    if (raw.length > 20) {
      return NextResponse.json(
        { error: "Max 20 emails per send" },
        { status: 400 }
      );
    }

    const cleanEmails = Array.from(
      new Set(
        raw
          .map((e) => String(e).trim().toLowerCase())
          .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
      )
    );
    if (cleanEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid emails in the list" },
        { status: 400 }
      );
    }

    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { name: true },
    });

    // Get-or-create the caller's referral code.
    let code = await prisma.referralCode.findUnique({
      where: { agencyId: session.user.agencyId! },
    });
    if (!code) {
      for (let i = 0; i < 5; i++) {
        const c = randomBytes(5).toString("base64url").slice(0, 8).toUpperCase();
        try {
          code = await prisma.referralCode.create({
            data: { agencyId: session.user.agencyId!, code: c },
          });
          break;
        } catch {
          /* unique collision; retry */
        }
      }
    }
    if (!code) {
      return NextResponse.json(
        { error: "Could not allocate referral code" },
        { status: 500 }
      );
    }

    const inviterFirst =
      session.user.name?.split(" ")[0] ?? session.user.email ?? "your friend";
    const shareUrl = `${SITE_URL}/signup?ref=${code.code}`;

    let sent = 0;
    let skipped = 0;

    for (const email of cleanEmails) {
      // Skip if this email already has an AutoQC account.
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        skipped++;
        continue;
      }
      // Skip if this code already invited this email.
      const existing = await prisma.referralInvite.findFirst({
        where: { codeId: code.id, inviteeEmail: email },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.referralInvite.create({
        data: {
          codeId: code.id,
          inviteeEmail: email,
        },
      });

      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
          <div style="display:inline-block;background:#10c76c;color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:16px;">${REWARD} free credits inside</div>
          <h2 style="margin:0 0 12px 0;font-size:18px;">${escapeHtml(inviterFirst)} thinks you'd love AutoQC.</h2>
          <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;">
            AutoQC is the QC layer for real estate photography — verticals, color, exposure, distractions, all caught and auto-fixed before your agent sees the photos. ${escapeHtml(inviterFirst)} uses it on${agency?.name ? ` ${escapeHtml(agency.name)}'s` : ""} listings and figured you'd want a try.
          </p>
          <p style="margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.5;">
            Sign up through the link below and you'll get <strong>${REWARD} free credits</strong> on the house — enough to QC ${REWARD} properties at no cost.
          </p>
          <p style="margin:20px 0;">
            <a href="${shareUrl}" style="display:inline-block;background:#10c76c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Claim ${REWARD} free credits &rarr;</a>
          </p>
          <p style="margin:20px 0 0 0;font-size:12px;color:#6b7280;">
            Or paste this link into your browser: ${shareUrl}
          </p>
        </div>
      </body></html>`;
      const text = `${inviterFirst} thinks you'd love AutoQC.

AutoQC catches what your editors miss — verticals, color, exposure, distractions, all auto-fixed before delivery.

Sign up through this link and get ${REWARD} free credits on the house:
${shareUrl}
`;

      sendEmail({
        to: email,
        subject: `${inviterFirst} sent you ${REWARD} AutoQC credits`,
        html,
        text,
      }).catch((err) => console.error("referral invite email failed", err));
      sent++;
    }

    return NextResponse.json({ sent, skipped });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[referrals/invite POST]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to send invites" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
