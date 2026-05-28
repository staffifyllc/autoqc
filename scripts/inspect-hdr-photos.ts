/**
 * Inspect HDR photos: show s3KeyOriginal vs s3KeyFixed, extension,
 * bracketKeys count, and status so we can see why thumbnails arent
 * rendering.
 */
import { prisma } from "../src/lib/db";

async function main() {
  // Find the most recent HDR property (hdrMode=true) and inspect its
  // photos.
  const property = await prisma.property.findFirst({
    where: { hdrMode: true },
    orderBy: { createdAt: "desc" },
    include: {
      photos: {
        orderBy: { fileName: "asc" },
        take: 10,
      },
    },
  });
  if (!property) {
    console.log("No HDR properties found.");
    return;
  }
  console.log(
    `Property: ${property.address}  id=${property.id}  status=${property.status}`
  );
  console.log(`Total photos: ${await prisma.photo.count({ where: { propertyId: property.id } })}`);
  console.table(
    property.photos.map((p) => ({
      fileName: p.fileName,
      status: p.status,
      qcScore: p.qcScore,
      brackets: (p.bracketKeys as string[]).length,
      origExt: p.s3KeyOriginal?.split(".").pop(),
      fixedExt: p.s3KeyFixed?.split(".").pop() ?? "(none)",
      fixedKey: p.s3KeyFixed?.slice(-50) ?? "(none)",
    }))
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
