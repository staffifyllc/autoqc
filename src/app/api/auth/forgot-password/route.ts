import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import { signPasswordResetToken } from "@/lib/auth/passwordResetToken";
import {
  renderPasswordResetEmail,
  PASSWORD_RESET_SUBJECT,
} from "@/lib/announcements/passwordReset";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.autoqc.io";

// POST /api/auth/forgot-password
// Always returns 200 regardless of whether the email exists. Prevents
// account enumeration. If the user exists, we fire an email with a
// signed 60-minute reset token.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = body?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ success: true });
    }
    const email = rawEmail.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordSetAt: true },
    });

    if (user) {
      const token = signPasswordResetToken(user.id, user.passwordSetAt);
      const resetUrl = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const { html, text } = renderPasswordResetEmail({ resetUrl, siteUrl: SITE_URL });
      const result = await sendEmail({
        to: email,
        subject: PASSWORD_RESET_SUBJECT,
        html,
        text,
      });
      if (result.error) {
        console.error("[forgot-password] send failed:", result.error, email);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[forgot-password] error:", e);
    // Still 200 — do not leak information to the client about failures.
    return NextResponse.json({ success: true });
  }
}
