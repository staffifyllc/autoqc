/**
 * Reconcile AutoQC Agency.isStaffifyClient against the Staffify
 * talent-console roster.
 *
 * Rules:
 *   - Agency owner email matches an active Staffify client       -> flag = true
 *   - Agency owner email NOT in the Staffify roster AND
 *     staffifyClientLockedManually = false                       -> flag = false
 *   - staffifyClientLockedManually = true                        -> leave alone
 *
 * Manual flips via the admin picker set the lock so this sync
 * never overrides them.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { fetchActiveStaffifyClientEmails } from "./clients";

export type SyncStats = {
  staffifyClients: number;
  agenciesConsidered: number;
  added: number;
  removed: number;
  unchanged: number;
  manualLocks: number;
  configured: boolean;
};

export type SyncDryRunSample = {
  willAdd: Array<{ agencyId: string; agencyName: string; email: string }>;
  willRemove: Array<{ agencyId: string; agencyName: string; email: string }>;
  manualLocks: Array<{ agencyId: string; agencyName: string }>;
};

export async function syncStaffifyClientFlags(opts: {
  dryRun?: boolean;
} = {}): Promise<{ stats: SyncStats; sample: SyncDryRunSample }> {
  const roster = await fetchActiveStaffifyClientEmails();
  if (!roster) {
    return {
      stats: {
        staffifyClients: 0,
        agenciesConsidered: 0,
        added: 0,
        removed: 0,
        unchanged: 0,
        manualLocks: 0,
        configured: false,
      },
      sample: { willAdd: [], willRemove: [], manualLocks: [] },
    };
  }

  // Walk every agency and inspect its owner email. AgencyMember role
  // "owner" wins; if no explicit owner, use the first member.
  const agencies = await prisma.agency.findMany({
    select: {
      id: true,
      name: true,
      isStaffifyClient: true,
      staffifyClientLockedManually: true,
      members: {
        select: {
          role: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  const sample: SyncDryRunSample = {
    willAdd: [],
    willRemove: [],
    manualLocks: [],
  };
  const toFlag = new Set<string>();
  const toUnflag = new Set<string>();
  let unchanged = 0;
  let manualLocks = 0;

  for (const a of agencies) {
    const ownerEmail = (() => {
      const owner = a.members.find((m) => m.role === "owner") ?? a.members[0];
      return owner?.user.email?.toLowerCase() ?? "";
    })();

    const isInRoster = ownerEmail ? roster.byEmail.has(ownerEmail) : false;

    if (a.staffifyClientLockedManually) {
      manualLocks++;
      sample.manualLocks.push({ agencyId: a.id, agencyName: a.name });
      continue;
    }

    if (isInRoster && !a.isStaffifyClient) {
      toFlag.add(a.id);
      sample.willAdd.push({
        agencyId: a.id,
        agencyName: a.name,
        email: ownerEmail,
      });
    } else if (!isInRoster && a.isStaffifyClient) {
      toUnflag.add(a.id);
      sample.willRemove.push({
        agencyId: a.id,
        agencyName: a.name,
        email: ownerEmail,
      });
    } else {
      unchanged++;
    }
  }

  if (!opts.dryRun) {
    const now = new Date();
    if (toFlag.size > 0) {
      await prisma.agency.updateMany({
        where: { id: { in: Array.from(toFlag) } },
        data: { isStaffifyClient: true, staffifyLastSyncedAt: now },
      });
    }
    if (toUnflag.size > 0) {
      await prisma.agency.updateMany({
        where: { id: { in: Array.from(toUnflag) } },
        data: { isStaffifyClient: false, staffifyLastSyncedAt: now },
      });
    }
    // Touch the synced-at on no-op agencies too so we can see the
    // sync did run against the whole table.
    if (toFlag.size === 0 && toUnflag.size === 0 && agencies.length > 0) {
      await prisma.agency.updateMany({
        where: { staffifyClientLockedManually: false },
        data: { staffifyLastSyncedAt: now },
      });
    }
  }

  return {
    stats: {
      staffifyClients: roster.total,
      agenciesConsidered: agencies.length,
      added: toFlag.size,
      removed: toUnflag.size,
      unchanged,
      manualLocks,
      configured: true,
    },
    sample,
  };
}

/**
 * On-signup helper. Called from /api/onboarding right after the agency
 * row is created so a new Staffify client gets the discount on their
 * very first dashboard page-load.
 */
export async function autoFlagOnSignup(args: {
  agencyId: string;
  ownerEmail: string;
}): Promise<{ flagged: boolean; reason?: string }> {
  const roster = await fetchActiveStaffifyClientEmails().catch(() => null);
  if (!roster) return { flagged: false, reason: "staffify sync not configured" };
  const inRoster = roster.byEmail.has(args.ownerEmail.toLowerCase());
  if (!inRoster) return { flagged: false, reason: "not in staffify roster" };

  await prisma.agency.update({
    where: { id: args.agencyId },
    data: {
      isStaffifyClient: true,
      staffifyLastSyncedAt: new Date(),
    },
  });
  return { flagged: true };
}
