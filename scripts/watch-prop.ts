import { prisma } from "../src/lib/db";
async function main() {
  const prop = await prisma.property.findFirst({ where: { address: "test drive", hdrMode: true }, orderBy: { createdAt: "desc" } });
  if (!prop) return;
  const photos = await prisma.photo.findMany({ where: { propertyId: prop.id }, select: { status: true, s3KeyFixed: true } });
  const by: Record<string,number> = {};
  let fixed = 0;
  for (const p of photos) { by[p.status]=(by[p.status]||0)+1; if(p.s3KeyFixed) fixed++; }
  console.log(JSON.stringify({ status: prop.status, statuses: by, withFixed: `${fixed}/${photos.length}` }));
}
main().finally(()=>prisma.$disconnect());
