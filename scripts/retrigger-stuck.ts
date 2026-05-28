import { prisma } from "../src/lib/db";
import { enqueueQCJob } from "../src/lib/sqs";

async function main() {
  const addr = process.argv[2] || "test drive";
  const prop = await prisma.property.findFirst({
    where: { address: addr, hdrMode: true },
    orderBy: { createdAt: "desc" },
  });
  if (!prop) { console.log("property not found:", addr); return; }
  const stuck = await prisma.photo.findMany({
    where: { propertyId: prop.id, status: "PROCESSING" },
    select: { id: true },
  });
  console.log(`"${prop.address}" (${prop.id}): ${stuck.length} stuck photos`);
  if (stuck.length === 0) return;
  // reset to PENDING then re-enqueue
  await prisma.photo.updateMany({
    where: { id: { in: stuck.map((s) => s.id) } },
    data: { status: "PENDING" },
  });
  await prisma.property.update({ where: { id: prop.id }, data: { status: "PROCESSING" } });
  await enqueueQCJob({
    propertyId: prop.id,
    agencyId: prop.agencyId,
    photoIds: stuck.map((s) => s.id),
  });
  console.log(`Re-enqueued ${stuck.length} photos on the 8GB/res-capped Lambda.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
