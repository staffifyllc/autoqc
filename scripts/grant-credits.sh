#!/bin/bash
# Grant test credits to an agency for testing
# Usage: ./scripts/grant-credits.sh <email> <credit_count>

EMAIL=${1:-paul@staffify.com}
CREDITS=${2:-100}

DATABASE_URL="postgresql://photoqc_admin:EFOY3Hn2vSWiB4XVcwlESiGd@photoqc-db.c0baioquaiv8.us-east-1.rds.amazonaws.com:5432/photoqc"

echo "Granting $CREDITS credits to $EMAIL..."

# This runs the SQL via Node since we have Prisma set up
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."

DATABASE_URL="$DATABASE_URL" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: '$EMAIL' }, include: { agencies: { include: { agency: true } } } });
  if (!user) { console.log('User not found: $EMAIL'); process.exit(1); }
  const agency = user.agencies[0]?.agency;
  if (!agency) { console.log('User has no agency'); process.exit(1); }
  await prisma.agency.update({ where: { id: agency.id }, data: { creditBalance: { increment: $CREDITS }, totalCreditsPurchased: { increment: $CREDITS } } });
  await prisma.creditTransaction.create({ data: { agencyId: agency.id, type: 'PROMO', amount: $CREDITS, description: 'Test credits granted' } });
  const updated = await prisma.agency.findUnique({ where: { id: agency.id } });
  console.log('Done. Agency ' + agency.name + ' now has ' + updated.creditBalance + ' credits.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
"
