import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import { signPasswordResetToken } from "@/lib/auth/passwordResetToken";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.autoqc.io";

// GET /api/agency/members — list members for the caller's agency.
export async function GET() {
  try {
    const session = await requireAgency();
    const members = await prisma.agencyMember.findMany({
      where: { agencyId: session.user.agencyId! },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            phone: true,
            passwordSetAt: true,
            createdAt: true,
          },
        },
      },
    });
    const callerUserId = session.user.id;
    const caller = members.find((m) => m.userId === callerUserId);
    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        isSelf: m.userId === callerUserId,
        // A member counts as "pending" if they have not yet set a password.
        // The invite email gave them a reset link; until they use it they
        // cannot log in.
        pending: !m.user.passwordSetAt,
        user: m.user,
      })),
      callerRole: caller?.role ?? null,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/agency/members — invite a teammate by email.
// Owner-only. Creates a User row with no password, attaches them as a
// member of the caller's agency, and emails them a signed reset-password
// link they click to set their initial password and log in.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();

    // Only owners can invite.
    const caller = await prisma.agencyMember.findFirst({
      where: {
        agencyId: session.user.agencyId!,
        userId: session.user.id,
      },
    });
    if (!caller || caller.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can invite teammates" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const firstName = (body.firstName as string | undefined)?.trim();
    const lastName = (body.lastName as string | undefined)?.trim();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId! },
      select: { name: true },
    });
    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Look up existing user by email (we don't want to duplicate users
    // across agencies — email is unique). If they already have an
    // account, attach them to this agency; otherwise create a shell.
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          name:
            firstName && lastName
              ? `${firstName} ${lastName}`
              : firstName || lastName || null,
          // UserRole enum doesn't have MEMBER; OTHER is the closest
          // neutral value for invited teammates until they pick one.
          role: "OTHER",
          marketingOptIn: true,
        },
      });
    }

    // Is this user already a member of this agency?
    const existing = await prisma.agencyMember.findFirst({
      where: { agencyId: session.user.agencyId!, userId: user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: `${email} is already on the team` },
        { status: 409 }
      );
    }

    // Is this user already a member of a DIFFERENT agency? Block the
    // invite — an account can only belong to one agency at a time.
    const otherMembership = await prisma.agencyMember.findFirst({
      where: { userId: user.id },
    });
    if (otherMembership) {
      return NextResponse.json(
        {
          error:
            "That email already belongs to a different AutoQC account. Each email can only be on one team at a time.",
        },
        { status: 409 }
      );
    }

    await prisma.agencyMember.create({
      data: {
        agencyId: session.user.agencyId!,
        userId: user.id,
        role: "member",
      },
    });

    // Sign an invite link. We reuse the password-reset token because it
    // is already bound to passwordSetAt — as soon as the invitee sets
    // their password the same token becomes unusable for a second attempt.
    const token = signPasswordResetToken(user.id, user.passwordSetAt ?? null);
    const inviteUrl = `${SITE_URL}/reset-password?token=${token}&invite=1`;
    const inviterName =
      session.user.name?.split(" ")[0] ?? session.user.email ?? "your teammate";
    const inviteeFirst = firstName || "there";

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#f4f5f7;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
        <div style="display:inline-block;background:#10c76c;color:#fff;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:16px;">Team invite</div>
        <h2 style="margin:0 0 12px 0;font-size:18px;">Hey ${escapeHtml(inviteeFirst)}, you're on the team.</h2>
        <p style="margin:0 0 12px 0;color:#374151;font-size:14px;line-height:1.5;">
          ${escapeHtml(inviterName)} added you to ${escapeHtml(agency.name)} on AutoQC. Click below to set your password and log in.
        </p>
        <p style="margin:20px 0;">
          <a href="${inviteUrl}" style="display:inline-block;background:#10c76c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Set your password &rarr;</a>
        </p>
        <p style="margin:20px 0 0 0;font-size:12px;color:#6b7280;">
          This link expires in 60 minutes. If you did not expect this invite, you can ignore the email.
        </p>
      </div>
    </body></html>`;

    const text = `Hey ${inviteeFirst},

${inviterName} added you to ${agency.name} on AutoQC. Click the link below to set your password and log in:

${inviteUrl}

This link expires in 60 minutes. If you did not expect this invite, you can ignore the email.
`;

    sendEmail({
      to: email,
      subject: `You've been added to ${agency.name} on AutoQC`,
      html,
      text,
    }).catch((err) => console.error("invite email failed", err));

    return NextResponse.json({ success: true, userId: user.id });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[agency/members POST]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to invite" },
      { status: 500 }
    );
  }
}

// DELETE /api/agency/members?userId=XYZ — remove a teammate.
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAgency();
    const caller = await prisma.agencyMember.findFirst({
      where: {
        agencyId: session.user.agencyId!,
        userId: session.user.id,
      },
    });
    if (!caller || caller.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can remove teammates" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 400 }
      );
    }

    await prisma.agencyMember.deleteMany({
      where: { agencyId: session.user.agencyId!, userId },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
