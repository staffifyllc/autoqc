import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUploadUrl, getS3Key } from "@/lib/s3";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAgency();
    const { propertyId, files } = await req.json();

    if (!propertyId || !files?.length) {
      return NextResponse.json(
        { error: "propertyId and files are required" },
        { status: 400 }
      );
    }

    // Verify property belongs to agency
    const property = await prisma.property.findFirst({
      where: { id: propertyId, agencyId: session.user.agencyId },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Generate presigned URLs for each file
    const uploads = await Promise.all(
      files.map(
        async (file: { name: string; type: string; size: number }) => {
          const s3Key = getS3Key(
            session.user.agencyId!,
            propertyId,
            file.name
          );
          const uploadUrl = await getUploadUrl(s3Key, file.type);

          // Create photo record
          const photo = await prisma.photo.create({
            data: {
              propertyId,
              fileName: file.name,
              s3KeyOriginal: s3Key,
              fileSize: file.size,
            },
          });

          return {
            photoId: photo.id,
            fileName: file.name,
            uploadUrl,
            s3Key,
          };
        }
      )
    );

    // Update property photo count
    await prisma.property.update({
      where: { id: propertyId },
      data: { photoCount: { increment: files.length } },
    });

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
