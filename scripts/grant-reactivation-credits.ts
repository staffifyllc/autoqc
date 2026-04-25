/**
 * Grants 5 PROMO credits to each agency in the idle cohort.
 *
 * The reactivation email promises "another 5 credits on top, on me",
 * so we grant them BEFORE the blast goes out. When the user logs back
 * in their balance already shows 10.
 *
 * Cohort filter matches scripts/idle-reactivation-blast.ts:
 *   - User is opted in
 *   - Signed up >= 24h ago
 *   - Their agency has 0 properties
 *
 * Each agency is credited at most once per run thanks to dedupe by
 * agencyId. PROMO type, never inflates totalCreditsPurchased.
 *
 * Usage:
 *   npx tsx scripts/grant-reactivation-credits.ts --count
 *   npx tsx scripts/grant-reactivation-credits.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const REACTIVATION_BONUS = 5;
const MIN_SIGNUP_AGE_HOURS = 24;
const DESCRIPTION = "Reactivation bonus: 5 credits to come back and try AutoQC";

async function findIdleAgencyIds(prisma: PrismaClient): Promise<string[]> {
  const cutoff = new Date(Date.now() - MIN_SIGNUP_AGE_HOURS * 60 * 60 * 1000);
  const candidates = await prisma.user.findMany({
    where: {
      marketingOptIn: true,
      email: { not: "" },
      createdAt: { lte: cutoff },
    },
    select: {
      email: true,
      agencies: {
        select: {
          agency: {
            select: {
              id: true,
              name: true,
              creditBalance: true,
              _count: { select: { properties: true } },
            },
          },
        },
      },
    },
  });

  const ids = new Set<string>();
  const log: Array<{
    email: string;
    agency: string;
    balance: number;
  }> = [];
  for (const u of candidates) {
    for (const a of u.agencies) {
      if (a.agency._count.properties > 0) continue;
      if (ids.has(a.agency.id)) continue;
      ids.add(a.agency.id);
      log.push({
        email: u.email,
        agency: a.agency.name ?? "(unnamed)",
        balance: a.agency.creditBalance,
      });
    }
  }
  console.log(`Idle agencies with 0 properties: ${ids.size}`);
  log.forEach((l) =>
    console.log(`  ${l.email}  ·  ${l.agency}  ·  current balance ${l.balance}`)
  );
  return Array.from(ids);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const count = args.includes("--count");
  if (!apply && !count) {
    console.error("Pick one: --count (dry run) or --apply (write).");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const agencyIds = await findIdleAgencyIds(prisma);
    if (!apply) {
      console.log();
      console.log(
        `[dry-run] Would grant +${REACTIVATION_BONUS} PROMO credits to ${agencyIds.length} agencies.`
      );
      return;
    }

    console.log();
    console.log(
      `[apply] Granting +${REACTIVATION_BONUS} PROMO credits to ${agencyIds.length} agencies...`
    );
    let applied = 0;
    for (const id of agencyIds) {
      await prisma.$transaction([
        prisma.agency.update({
          where: { id },
          data: { creditBalance: { increment: REACTIVATION_BONUS } },
        }),
        prisma.creditTransaction.create({
          data: {
            agencyId: id,
            type: "PROMO",
            amount: REACTIVATION_BONUS,
            description: DESCRIPTION,
          },
        }),
      ]);
      applied++;
    }
    console.log(`Done. credited=${applied} agencies.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
