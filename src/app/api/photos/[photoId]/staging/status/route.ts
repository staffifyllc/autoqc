import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/photos/[photoId]/staging/status
// Tiny lookup the StagingButton calls when the modal opens. Returns
// whether this photo has been unlocked for staging (i.e. the 2-credit
// unlock charge has already fired). If yes, the modal skips the
// confirm dialog and goes straight to style chips.
export async function GET(
  _req: Request,
  { params }: { params: { photoId: string } }
) {
  try {
    const session = await requireAgency();
    const photo = await prisma.photo.findFirst({
      where: {
        id: params.photoId,
        property: { agencyId: session.user.agencyId },
      },
      select: { stagingUnlockedAt: true },
    });
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      unlocked: !!photo.stagingUnlockedAt,
      unlockedAt: photo.stagingUnlockedAt,
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
