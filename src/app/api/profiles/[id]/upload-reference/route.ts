import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUploadUrl } from "@/lib/s3";

// POST /api/profiles/[id]/upload-reference
// Returns presigned S3 URLs for uploading reference photos to a Style Profile
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const { files } = await req.json();

    if (!files?.length) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Verify profile belongs to agency
    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Generate presigned URLs and S3 keys for each reference photo
    const uploads = await Promise.all(
      files.map(async (file: { name: string; type: string }) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const s3Key = `reference-photos/${session.user.agencyId}/${
          profile.id
        }/${Date.now()}_${safeName}`;
        const uploadUrl = await getUploadUrl(s3Key, file.type);
        return {
          fileName: file.name,
          uploadUrl,
          s3Key,
        };
      })
    );

    return NextResponse.json({ uploads });
  } catch (error: any) {
    console.error("Reference upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// PATCH /api/profiles/[id]/upload-reference
// Confirms uploads completed and saves S3 keys to the profile
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const { s3Keys } = await req.json();

    if (!Array.isArray(s3Keys)) {
      return NextResponse.json(
        { error: "s3Keys array required" },
        { status: 400 }
      );
    }

    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Append new keys to existing reference photos
    const updated = await prisma.styleProfile.update({
      where: { id: params.id },
      data: {
        referencePhotos: {
          set: [...profile.referencePhotos, ...s3Keys],
        },
      },
    });

    return NextResponse.json({
      success: true,
      referencePhotoCount: updated.referencePhotos.length,
    });
  } catch (error: any) {
    console.error("Save reference error:", error);
    return NextResponse.json(
      { error: error.message || "Save failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/profiles/[id]/upload-reference?key=...
// Removes a single reference photo
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }

    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.styleProfile.update({
      where: { id: params.id },
      data: {
        referencePhotos: {
          set: profile.referencePhotos.filter((k) => k !== key),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}
