import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/announcements/unsubscribeToken";

// GET or POST /api/unsubscribe?token=...
// Public route. Verifies the HMAC-signed token and flips the user's
// marketingOptIn flag to false. Idempotent: re-clicking the link from
// an old email still works and reports success.

async function handle(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired unsubscribe link." },
      { status: 400 }
    );
  }

  if (userId === "preview") {
    // Admin preview token. Do nothing real, just acknowledge.
    return NextResponse.json({ ok: true, preview: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, marketingOptIn: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Account not found." },
      { status: 404 }
    );
  }

  if (user.marketingOptIn) {
    await prisma.user.update({
      where: { id: userId },
      data: { marketingOptIn: false },
    });
  }

  return NextResponse.json({ ok: true, email: user.email });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
