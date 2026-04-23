/**
 * One-off cleanup:
 *   1. Delete the luximmophoto user + agency entirely.
 *   2. Reduce any non-admin, non-flylisted agency with >10 credits down to 10,
 *      logging an ADJUSTMENT transaction for the diff.
 *
 * Dry-run: npx tsx scripts/cleanup-credits.ts
 * Apply:   npx tsx scripts/cleanup-credits.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const DELETE_EMAIL = "luximmophoto@gmail.com";
const TARGET_BALANCE = 10;

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    console.log(apply ? "APPLY mode" : "DRY RUN (pass --apply to execute)");
    console.log();

    // 1. Delete luximmophoto
    const target = await prisma.user.findUnique({
      where: { email: DELETE_EMAIL },
      include: { agencies: { include: { agency: true } } },
    });
    if (!target) {
      console.log(`User ${DELETE_EMAIL} not found, skipping delete`);
    } else {
      console.log(`Deleting user ${target.email} (id ${target.id})`);
      for (const m of target.agencies) {
        console.log(`  -> cascade will drop agency ${m.agency.name} (${m.agency.id})`);
      }
      if (apply) {
        for (const m of target.agencies) {
          await prisma.usageRecord.deleteMany({ where: { agencyId: m.agencyId } });
          await prisma.agency.delete({ where: { id: m.agencyId } });
        }
        await prisma.user.delete({ where: { id: target.id } });
        console.log("  done");
      }
    }
    console.log();

    // 2. Cap non-admin non-flylisted balances at 10
    const overfilled = await prisma.agency.findMany({
      where: {
        creditBalance: { gt: TARGET_BALANCE },
        isAdmin: false,
      },
      select: {
        id: true,
        name: true,
        creditBalance: true,
        members: { select: { user: { select: { email: true } } }, take: 1 },
      },
    });

    for (const a of overfilled) {
      const ownerEmail = a.members[0]?.user.email ?? "?";
      if (ownerEmail.endsWith("@flylisted.com")) {
        console.log(`  skip flylisted: ${a.name} (${ownerEmail}) balance=${a.creditBalance}`);
        continue;
      }
      const delta = TARGET_BALANCE - a.creditBalance;
      console.log(`  cap: ${a.name} (${ownerEmail}) ${a.creditBalance} -> ${TARGET_BALANCE} (delta ${delta})`);
      if (apply) {
        await prisma.$transaction([
          prisma.agency.update({
            where: { id: a.id },
            data: { creditBalance: TARGET_BALANCE },
          }),
          prisma.creditTransaction.create({
            data: {
              agencyId: a.id,
              type: "ADJUSTMENT",
              amount: delta,
              description: `Policy cap: balances capped at ${TARGET_BALANCE}`,
            },
          }),
        ]);
      }
    }
    console.log();
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
