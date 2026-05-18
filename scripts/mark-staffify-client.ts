/**
 * Mark an AutoQC agency as a Staffify partner client.
 *
 * Staffify partners automatically get 50% off property processing:
 *   - Credit packs: $5/credit (vs the public $10/credit)
 *   - PAYG:        $6/property (vs the public $12/property)
 *
 * Virtual staging is NOT discounted - it already runs on its own
 * stagingCreditCost field. The 50% off lives in per-credit price only.
 *
 * Identifies the target agency by either:
 *   - --agency-id <cuid>   exact Agency.id
 *   - --email <addr>       owner's User.email (finds their primary agency)
 *
 * Usage:
 *   # See what would be marked (no write):
 *   npx tsx scripts/mark-staffify-client.ts --email tj@architecturalstorytelling.com
 *
 *   # Actually flip the flag:
 *   npx tsx scripts/mark-staffify-client.ts --email tj@architecturalstorytelling.com --apply
 *
 *   # Unmark (turn the flag off):
 *   npx tsx scripts/mark-staffify-client.ts --email tj@architecturalstorytelling.com --apply --off
 *
 *   # List every agency currently flagged as Staffify:
 *   npx tsx scripts/mark-staffify-client.ts --list
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

type Args = {
  agencyId?: string;
  email?: string;
  apply: boolean;
  off: boolean;
  list: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    off: false,
    list: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--apply") args.apply = true;
    else if (flag === "--off") args.off = true;
    else if (flag === "--list") args.list = true;
    else if (flag === "--agency-id") args.agencyId = argv[++i];
    else if (flag === "--email") args.email = argv[++i];
  }
  return args;
}

async function listFlagged(prisma: PrismaClient) {
  const agencies = await prisma.agency.findMany({
    where: { isStaffifyClient: true },
    select: {
      id: true,
      name: true,
      creditBalance: true,
      customCreditPriceCents: true,
      hasPaymentMethod: true,
      members: {
        where: { role: "owner" },
        select: { user: { select: { email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  if (agencies.length === 0) {
    console.log("No agencies are currently flagged as Staffify clients.");
    return;
  }

  console.log(`Staffify-flagged agencies (${agencies.length}):`);
  for (const a of agencies) {
    const ownerEmail = a.members[0]?.user.email || "(no owner)";
    const rate =
      a.customCreditPriceCents != null
        ? `$${(a.customCreditPriceCents / 100).toFixed(2)}/credit (negotiated)`
        : "$5/credit (auto 50% off)";
    console.log(
      `  ${a.name.padEnd(36)} ${ownerEmail.padEnd(36)} ${rate}  bal=${a.creditBalance}`,
    );
  }
}

async function resolveAgencyId(
  prisma: PrismaClient,
  args: Args,
): Promise<{ id: string; name: string; ownerEmail: string } | null> {
  if (args.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: args.agencyId },
      select: {
        id: true,
        name: true,
        members: {
          where: { role: "owner" },
          select: { user: { select: { email: true } } },
        },
      },
    });
    if (!agency) {
      console.error(`No agency with id ${args.agencyId}`);
      return null;
    }
    return {
      id: agency.id,
      name: agency.name,
      ownerEmail: agency.members[0]?.user.email || "(no owner)",
    };
  }

  if (args.email) {
    const user = await prisma.user.findUnique({
      where: { email: args.email.toLowerCase() },
      select: {
        email: true,
        agencies: {
          select: {
            role: true,
            agency: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) {
      console.error(`No user with email ${args.email}`);
      return null;
    }
    if (user.agencies.length === 0) {
      console.error(`User ${user.email} is not in any agency.`);
      return null;
    }
    // Prefer the owner role, fall back to first membership.
    const ownerMembership =
      user.agencies.find((m) => m.role === "owner") || user.agencies[0];
    return {
      id: ownerMembership.agency.id,
      name: ownerMembership.agency.name,
      ownerEmail: user.email,
    };
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    if (args.list) {
      await listFlagged(prisma);
      return;
    }

    if (!args.agencyId && !args.email) {
      console.error(
        "Specify --agency-id <cuid> or --email <addr>. Or use --list to see flagged agencies.",
      );
      process.exitCode = 1;
      return;
    }

    const target = await resolveAgencyId(prisma, args);
    if (!target) {
      process.exitCode = 1;
      return;
    }

    const current = await prisma.agency.findUnique({
      where: { id: target.id },
      select: {
        isStaffifyClient: true,
        customCreditPriceCents: true,
      },
    });

    const desired = !args.off;
    console.log(`Agency: ${target.name} (${target.id})`);
    console.log(`Owner:  ${target.ownerEmail}`);
    console.log(`Current isStaffifyClient: ${current?.isStaffifyClient}`);
    console.log(`Will set isStaffifyClient: ${desired}`);

    if (current?.customCreditPriceCents != null && desired) {
      console.log(
        `Note: this agency already has a negotiated rate of ` +
          `$${(current.customCreditPriceCents / 100).toFixed(2)}/credit. ` +
          `Setting isStaffifyClient=true is harmless - the explicit rate ` +
          `still wins until you clear customCreditPriceCents.`,
      );
    }

    if (!args.apply) {
      console.log("\nDry run. Add --apply to actually write the change.");
      return;
    }

    if (current?.isStaffifyClient === desired) {
      console.log("\nAlready set. Nothing to do.");
      return;
    }

    await prisma.agency.update({
      where: { id: target.id },
      data: { isStaffifyClient: desired },
    });

    console.log(
      `\nUpdated ${target.name}: isStaffifyClient -> ${desired}. ` +
        (desired
          ? "They now see $5/credit, $6/property auto-pricing."
          : "They are back on public pricing ($10/credit, $12/property)."),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
