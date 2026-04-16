import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import AdminClient from "./AdminClient";

// Force dynamic rendering so the session check runs on every request.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Server-side gate. Non-admins get bounced to /dashboard before any
  // part of the admin UI is sent over the wire. No data, no scaffold,
  // no "Admin only" flash.
  const session = await getSession();
  if (!session?.user?.id || !session.user.agencyId) {
    redirect("/dashboard");
  }
  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId },
    select: { isAdmin: true },
  });
  if (!agency?.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminClient />;
}
