/**
 * One-off: find the Flylisted agency record and flip hdrMergeEnabled = true.
 * Idempotent; safe to re-run.
 *
 * Usage: npx tsx scripts/enable-hdr-flylisted.ts [--list-only]
 */
import { prisma } from "../src/lib/db";

async function main() {
  const listOnly = process.argv.includes("--list-only");

  const matches = await prisma.agency.findMany({
    where: {
      OR: [
        { name: { contains: "Flylisted", mode: "insensitive" } },
        { name: { contains: "Fly listed", mode: "insensitive" } },
        // Paul's personal test agency. Keeps the dev / test loop tight
        // so we don't have to log in/out of Flylisted to try a change.
        { name: { contains: "pchareth", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      hdrMergeEnabled: true,
      createdAt: true,
      _count: { select: { properties: true, members: true } },
    },
  });

  if (matches.length === 0) {
    console.log("No Flylisted agency found. Inspect manually:");
    const recent = await prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, createdAt: true },
    });
    console.table(recent);
    return;
  }

  console.log(`Found ${matches.length} match(es):`);
  console.table(matches.map((a) => ({
    id: a.id,
    name: a.name,
    hdr: a.hdrMergeEnabled,
    props: a._count.properties,
    members: a._count.members,
    createdAt: a.createdAt.toISOString().slice(0, 10),
  })));

  if (listOnly) return;

  for (const a of matches) {
    if (a.hdrMergeEnabled) {
      console.log(`Skip ${a.name} (${a.id}) — already enabled`);
      continue;
    }
    await prisma.agency.update({
      where: { id: a.id },
      data: { hdrMergeEnabled: true },
    });
    console.log(`Enabled hdrMergeEnabled for ${a.name} (${a.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
