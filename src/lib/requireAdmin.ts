import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Admin gate for internal usage / revenue / signup pages.
 * The current user must belong to an agency marked isAdmin=true.
 * Throws the standard auth error strings so existing error-boundary
 * redirects keep working.
 */
export async function requireAdmin() {
  const session = await requireAgency();
  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId! },
    select: { isAdmin: true },
  });
  if (!agency?.isAdmin) {
    throw new Error("Unauthorized");
  }
  return session;
}
