import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/account/profile
// Returns the signed-in user's personal info plus their primary agency.
export async function GET() {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = await prisma.agencyMember.findFirst({
      where: { userId: user.id },
      select: { agency: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      user,
      agency: membership?.agency ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// PATCH /api/account/profile
// Updates the signed-in user's name / email and their agency name.
// No verification on email change — straight overwrite. Confirmed with
// Paul on 2026-04-23: single-user product, they can change it back.
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
    const agencyName = typeof body?.agencyName === "string" ? body.agencyName.trim() : undefined;

    if (emailRaw !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return NextResponse.json(
          { error: "That email does not look right." },
          { status: 400 }
        );
      }
      // Block collision with another account.
      const existing = await prisma.user.findUnique({
        where: { email: emailRaw },
        select: { id: true },
      });
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json(
          { error: "Another account already uses that email." },
          { status: 409 }
        );
      }
    }

    if (name !== undefined || emailRaw !== undefined) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(emailRaw !== undefined ? { email: emailRaw } : {}),
        },
      });
    }

    if (agencyName !== undefined) {
      if (agencyName.length === 0) {
        return NextResponse.json(
          { error: "Company name cannot be empty." },
          { status: 400 }
        );
      }
      const membership = await prisma.agencyMember.findFirst({
        where: { userId: session.user.id },
        select: { agencyId: true },
      });
      if (membership) {
        await prisma.agency.update({
          where: { id: membership.agencyId },
          data: { name: agencyName },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[profile] PATCH error:", e);
    return NextResponse.json(
      { error: "Could not save. Try again." },
      { status: 500 }
    );
  }
}
