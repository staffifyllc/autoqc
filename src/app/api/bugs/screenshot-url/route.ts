import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUploadUrl } from "@/lib/s3";

// POST /api/bugs/screenshot-url
// Returns a presigned S3 PUT URL for a bug-report screenshot. The key
// lives under bug-screenshots/<userId>/<ts>-<filename> so it is easy to
// clean up later. 5 MB max enforced client-side.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { fileName, contentType } = await req.json();

    const safeName = String(fileName || "screenshot.png")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const type = String(contentType || "image/png").slice(0, 60);
    const key = `bug-screenshots/${session.user.id}/${Date.now()}-${safeName}`;
    const uploadUrl = await getUploadUrl(key, type);
    return NextResponse.json({ uploadUrl, key });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Failed to get upload URL." },
      { status: 500 }
    );
  }
}
