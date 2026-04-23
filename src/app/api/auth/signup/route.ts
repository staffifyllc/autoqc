import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Self-serve signup. Creates a User row with a bcrypt password hash, or
// claims an existing User that was created (e.g. by an invite) but never
// had a password set. After this succeeds the client should call
// signIn("dev-login", ...) to start the session, then send the user to
// /onboarding to create their Agency.
//
// Follow-ups (Stage 3 auth backlog): email verification, rate limiting,
// password reset via signed-token email.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = body?.email;
    const password = body?.password;

    if (!rawEmail || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 10) {
      return NextResponse.json(
        { error: "Password must be at least 10 characters." },
        { status: 400 }
      );
    }

    const email = String(rawEmail).toLowerCase().trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return NextResponse.json(
        { error: "That email does not look right." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (existing?.passwordHash) {
      return NextResponse.json(
        {
          error:
            "An account with that email already exists. Sign in instead.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
      // Row was created earlier (invite, onboarding in progress, etc.) but
      // the user never set a password. Claim it by attaching one now.
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, passwordSetAt: new Date() },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          passwordSetAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[signup] error:", e);
    return NextResponse.json(
      { error: "Signup failed. Try again." },
      { status: 500 }
    );
  }
}
