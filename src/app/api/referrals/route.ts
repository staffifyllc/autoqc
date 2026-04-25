import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.autoqc.io";

// Lazy-create the agency's referral code. Eight chars, base32-ish.
async function getOrCreateCode(agencyId: string) {
  const existing = await prisma.referralCode.findUnique({
    where: { agencyId },
  });
  if (existing) return existing;
  // Loop until we find an unused code. Tiny collision risk at 36^8 entropy.
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(5).toString("base64url").slice(0, 8).toUpperCase();
    try {
      return await prisma.referralCode.create({
        data: { agencyId, code },
      });
    } catch {
      // unique violation; try again
    }
  }
  throw new Error("Could not allocate referral code");
}

// GET /api/referrals — caller's code + their invite list + total credits earned.
export async function GET() {
  try {
    const session = await requireAgency();
    const code = await getOrCreateCode(session.user.agencyId!);
    const invites = await prisma.referralInvite.findMany({
      where: { codeId: code.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const totalEarned = invites.reduce((s, i) => s + (i.creditsEarned ?? 0), 0);
    return NextResponse.json({
      code: {
        code: code.code,
        shareUrl: `${SITE_URL}/signup?ref=${code.code}`,
      },
      referrals: invites.map((i) => ({
        id: i.id,
        inviteeEmail: i.inviteeEmail,
        status: i.status,
        createdAt: i.createdAt,
        creditedAt: i.creditedAt,
        creditsEarned: i.creditsEarned,
      })),
      totalEarned,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[referrals GET]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
