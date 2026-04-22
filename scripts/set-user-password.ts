/**
 * Admin-only: assign a password to an existing user.
 *
 * Usage (run from repo root):
 *   npx tsx scripts/set-user-password.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/set-user-password.ts pchareth@gmail.com "Temporary-Password-42"
 *
 * The user can change their password afterward at /dashboard/account.
 * Requires DATABASE_URL in env (picks up from .env / .env.local).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , rawEmail, password] = process.argv;

  if (!rawEmail || !password) {
    console.error(
      "Usage: npx tsx scripts/set-user-password.ts <email> <password>"
    );
    process.exit(1);
  }

  if (password.length < 10) {
    console.error(
      "Password is too short. Use at least 10 characters."
    );
    process.exit(1);
  }

  const email = rawEmail.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`No user with email "${email}" exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordSetAt: new Date() },
  });

  console.log(`Password set for ${email} (${user.name ?? "no name"}).`);
  console.log(`They can log in at https://www.autoqc.io/login now.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
