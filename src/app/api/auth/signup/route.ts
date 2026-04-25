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
    const refCode = (body?.ref as string | undefined)?.trim().toUpperCase();

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

    let userId: string;
    if (existing) {
      // Row was created earlier (invite, onboarding in progress, etc.) but
      // the user never set a password. Claim it by attaching one now.
      const u = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, passwordSetAt: new Date() },
        select: { id: true },
      });
      userId = u.id;
    } else {
      const u = await prisma.user.create({
        data: {
          email,
          passwordHash,
          passwordSetAt: new Date(),
        },
        select: { id: true },
      });
      userId = u.id;
    }

    // If the visitor came in through a ?ref= referral link, mark the
    // matching ReferralInvite row as SIGNED_UP so we can credit the
    // inviter when this new agency processes a paid property. We
    // upsert because the invite may not have existed (organic signup
    // via a shared link rather than an explicit emailed invite).
    if (refCode) {
      try {
        const code = await prisma.referralCode.findUnique({
          where: { code: refCode },
        });
        if (code) {
          await prisma.referralInvite.upsert({
            where: {
              codeId_inviteeEmail: { codeId: code.id, inviteeEmail: email },
            },
            update: { status: "SIGNED_UP", signedUpUserId: userId },
            create: {
              codeId: code.id,
              inviteeEmail: email,
              status: "SIGNED_UP",
              signedUpUserId: userId,
            },
          });
        }
      } catch (refErr) {
        console.error("[signup referral] non-fatal:", refErr);
      }
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
