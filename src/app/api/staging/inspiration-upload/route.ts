import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAgency } from "@/lib/auth";
import { getUploadUrl } from "@/lib/s3";

// POST /api/staging/inspiration-upload
// Body: { fileName: string, contentType: string }
// Returns a presigned PUT URL for an ephemeral S3 object the client
// uses as a style reference on a staging render. No Photo/Property row
// is created — these live under staging/inspiration/ and can be pruned
// on a schedule if we ever want to reclaim storage.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required" },
        { status: 400 }
      );
    }

    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Inspiration must be an image" },
        { status: 400 }
      );
    }

    const ext = fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? ".jpg";
    const s3Key = `${session.user.agencyId}/staging/inspiration/${randomUUID()}${ext}`;
    const uploadUrl = await getUploadUrl(s3Key, contentType);

    return NextResponse.json({ uploadUrl, s3Key });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[staging/inspiration-upload]", e);
    return NextResponse.json({ error: "Upload URL failed" }, { status: 500 });
  }
}
