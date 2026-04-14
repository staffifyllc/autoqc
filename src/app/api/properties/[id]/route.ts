import { NextRequest, NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueQCJob } from "@/lib/sqs";
import { chargeForProperty, checkPaymentCapability } from "@/lib/credits";

// GET /api/properties/[id] - get property with photos
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();

    const property = await prisma.property.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      include: {
        client: true,
        photos: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ property });
  } catch (error) {
    console.error("Property detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch property" },
      { status: 500 }
    );
  }
}

// POST /api/properties/[id] - trigger QC run
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();
    const { action } = await req.json();

    const property = await prisma.property.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      include: { photos: true, client: true },
    });

    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    if (action === "run_qc") {
      // PAYMENT GATE: Must charge BEFORE processing
      const chargeResult = await chargeForProperty(
        session.user.agencyId!,
        params.id,
        property.photos.length
      );

      if (!chargeResult.success) {
        return NextResponse.json(
          {
            error: "Payment required",
            message: chargeResult.error,
            redirect: "/dashboard/credits",
          },
          { status: 402 } // Payment Required
        );
      }

      // Payment successful, now process
      await prisma.property.update({
        where: { id: params.id },
        data: { status: "PROCESSING" },
      });

      await prisma.photo.updateMany({
        where: { propertyId: params.id },
        data: { status: "PROCESSING" },
      });

      await enqueueQCJob({
        propertyId: params.id,
        agencyId: session.user.agencyId!,
        photoIds: property.photos.map((p) => p.id),
        clientProfileId: property.clientProfileId || undefined,
      });

      return NextResponse.json({
        status: "processing",
        paymentMethod: chargeResult.method,
      });
    }

    if (action === "approve_all") {
      await prisma.photo.updateMany({
        where: { propertyId: params.id, status: "FLAGGED" },
        data: { status: "APPROVED" },
      });

      await prisma.property.update({
        where: { id: params.id },
        data: { status: "APPROVED" },
      });

      return NextResponse.json({ status: "approved" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Property action error:", error);
    return NextResponse.json(
      { error: "Action failed" },
      { status: 500 }
    );
  }
}
