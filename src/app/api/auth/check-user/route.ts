import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ hasAgency: false });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { agencies: true },
  });

  return NextResponse.json({
    hasAgency:
      !!user && user.agencies.length > 0,
  });
}
