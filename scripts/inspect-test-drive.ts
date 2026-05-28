import { prisma } from "../src/lib/db";
async function main() {
  const props = await prisma.property.findMany({
    where: { hdrMode: true },
    orderBy: { createdAt: "desc" },
    take: 4,
    include: { _count: { select: { photos: true } } },
  });
  for (const p of props) {
    const photos = await prisma.photo.findMany({
      where: { propertyId: p.id },
      select: { status: true, bracketKeys: true, s3KeyFixed: true, fileName: true, qcScore: true },
    });
    const byStatus: Record<string, number> = {};
    let withFixed = 0, singletons = 0, brackets = 0;
    for (const ph of photos) {
      byStatus[ph.status] = (byStatus[ph.status] || 0) + 1;
      if (ph.s3KeyFixed) withFixed++;
      const bk = (ph.bracketKeys as string[]) || [];
      if (bk.length === 1) singletons++;
      else if (bk.length >= 2) brackets++;
    }
    console.log(`\n=== "${p.address}" (${p.id})`);
    console.log(`   created ${p.createdAt.toISOString().slice(0,16)}  status=${p.status}  photos=${p._count.photos}`);
    console.log(`   statuses:`, byStatus);
    console.log(`   bracketKeys: ${brackets} multi-frame, ${singletons} single, ${photos.length - brackets - singletons} empty`);
    console.log(`   s3KeyFixed present: ${withFixed}/${photos.length}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
