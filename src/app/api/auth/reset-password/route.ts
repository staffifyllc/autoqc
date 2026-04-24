import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPasswordResetToken } from "@/lib/auth/passwordResetToken";

// POST /api/auth/reset-password
// Verifies the signed reset token, confirms it was issued for the user's
// current passwordSetAt (so once the password is reset, any other
// outstanding tokens are invalidated), then writes the new passwordHash
// and bumps passwordSetAt.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;
    const password = body?.password;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 10) {
      return NextResponse.json(
        { error: "Password must be at least 10 characters." },
        { status: 400 }
      );
    }

    const result = verifyPasswordResetToken(token);
    if (!result.ok) {
      const message =
        result.reason === "expired"
          ? "This reset link has expired. Request a new one."
          : "This reset link is invalid. Request a new one.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, passwordSetAt: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid. Request a new one." },
        { status: 400 }
      );
    }

    // Token invalidated if the user has reset their password since the
    // token was issued. The token binds to passwordSetAt.getTime().
    const currentStamp = user.passwordSetAt ? user.passwordSetAt.getTime() : 0;
    if (currentStamp !== result.stamp) {
      return NextResponse.json(
        { error: "This reset link has already been used. Request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordSetAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json({ error: "Reset failed. Try again." }, { status: 500 });
  }
}
