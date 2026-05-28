/**
 * Sanity check: confirm the HDR pipeline is isolated to Flylisted.
 * Nothing else in the database should have hdrMergeEnabled or any
 * bracketKeys populated.
 */
import { prisma } from "../src/lib/db";

async function main() {
  const totalAgencies = await prisma.agency.count();
  const hdrAgencies = await prisma.agency.findMany({
    where: { hdrMergeEnabled: true },
    select: { id: true, name: true },
  });
  const totalPhotos = await prisma.photo.count();
  const photosWithBrackets = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "Photo"
    WHERE array_length("bracketKeys", 1) >= 1
  `;

  console.log({
    totalAgencies,
    hdrEnabledCount: hdrAgencies.length,
    hdrEnabledNames: hdrAgencies.map((a) => a.name),
    totalPhotos,
    photosWithBracketKeys: Number(photosWithBrackets[0]?.count ?? 0),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
