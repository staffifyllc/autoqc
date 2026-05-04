/**
 * Feature-power blast. Sends the "AutoQC, end to end" tour
 * (renderFeaturePowerEmail) to every opted-in user with an account.
 *
 * Sibling of `scripts/announce-blast.ts` (which still uses the older
 * whatsNew template). Same Resend pattern, same unsubscribe-token flow,
 * same dry-run-first ergonomics. Differences:
 *   - imports renderFeaturePowerEmail / FEATURE_POWER_SUBJECT
 *   - excludes the locked-out internal account (hello@gostaffify.com)
 *   - excludes users who only belong to admin agencies (you)
 *
 * Usage:
 *   npx tsx scripts/feature-power-blast.ts --count
 *   npx tsx scripts/feature-power-blast.ts --mode=test --to=you@example.com
 *   npx tsx scripts/feature-power-blast.ts --mode=all
 *
 * Env: DATABASE_URL, NEXTAUTH_SECRET, RESEND_API_KEY
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  renderFeaturePowerEmail,
  FEATURE_POWER_SUBJECT,
} from "../src/lib/announcements/featurePower";
import { signUnsubscribeToken } from "../src/lib/announcements/unsubscribeToken";

const FROM = "Paul Chareth <hello@autoqc.io>";
const REPLY_TO = "pchareth@gmail.com";
const SITE_URL = "https://www.autoqc.io";
const SEND_DELAY_MS = 150;

// Hard-block list. Locked-out internal addresses, anything we never
// want a marketing send hitting again.
const EMAIL_BLOCKLIST = new Set<string>([
  "hello@gostaffify.com",
]);

const RESEND_KEY = process.env.RESEND_API_KEY;

async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!RESEND_KEY) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      reply_to: REPLY_TO,
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) {
    return { error: data?.message ?? `HTTP ${res.status}` };
  }
  return { id: data.id };
}

type Recipient = { id: string; email: string; name: string | null };

async function loadRecipients(prisma: PrismaClient): Promise<Recipient[]> {
  // Pull every opted-in user with their agency memberships, then drop
  // anyone who only belongs to admin agencies. A user who is in BOTH a
  // real agency AND an admin agency still gets the email. We also drop
  // anyone in the hard blocklist.
  const users = await prisma.user.findMany({
    where: { marketingOptIn: true, email: { not: "" } },
    select: {
      id: true,
      email: true,
      name: true,
      agencies: {
        select: { agency: { select: { isAdmin: true } } },
      },
    },
  });

  const seenEmails = new Set<string>();
  const out: Recipient[] = [];
  for (const u of users) {
    const lower = u.email.toLowerCase();
    if (EMAIL_BLOCKLIST.has(lower)) continue;
    if (seenEmails.has(lower)) continue;
    seenEmails.add(lower);

    const memberships = u.agencies;
    if (memberships.length > 0) {
      const everyAdmin = memberships.every((m) => m.agency.isAdmin);
      if (everyAdmin) continue;
    }
    out.push({ id: u.id, email: u.email, name: u.name });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="));
  const mode = modeArg?.split("=")[1] ?? (args.includes("--count") ? "count" : "");
  if (!mode) {
    console.error(
      "Pick one: --count, --mode=test, or --mode=all. --mode=test optionally takes --to=you@example.com",
    );
    process.exit(1);
  }
  const toArg = args.find((a) => a.startsWith("--to="));
  const testTo = toArg?.split("=")[1];

  const prisma = new PrismaClient();
  try {
    let recipients: Recipient[];

    if (mode === "count") {
      const list = await loadRecipients(prisma);
      console.log(`Eligible recipients: ${list.length}`);
      console.log("First 10 (sanity check):");
      list.slice(0, 10).forEach((u) =>
        console.log(`  ${u.email}  (${u.name ?? "(no name)"})`),
      );
      console.log();
      console.log(`Subject: ${FEATURE_POWER_SUBJECT}`);
      console.log(`From:    ${FROM}`);
      console.log(`Reply:   ${REPLY_TO}`);
      return;
    }

    if (mode === "test") {
      if (testTo) {
        recipients = [{ id: "preview", email: testTo, name: "Test" }];
      } else {
        const adminMember = await prisma.agencyMember.findFirst({
          where: { agency: { isAdmin: true } },
          select: { user: { select: { id: true, email: true, name: true } } },
        });
        if (!adminMember?.user?.email) {
          console.error("No admin user found. Pass --to=you@example.com explicitly.");
          process.exit(1);
        }
        recipients = [adminMember.user];
      }
    } else if (mode === "all") {
      recipients = await loadRecipients(prisma);
    } else {
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
    }

    console.log(`[${mode}] Sending to ${recipients.length} recipient(s) from ${FROM}`);
    let sent = 0;
    let failed = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const tokenSubject = r.id === "preview" ? "preview" : r.id;
      const token = signUnsubscribeToken(tokenSubject);
      const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${token}`;
      const { html, text } = renderFeaturePowerEmail({
        recipientName: r.name,
        unsubscribeUrl,
        siteUrl: SITE_URL,
      });
      const result = await sendViaResend({
        to: r.email,
        subject: FEATURE_POWER_SUBJECT,
        html,
        text,
      });
      if (result.error) {
        failed++;
        failures.push({ email: r.email, error: result.error });
        console.log(
          `  ${i + 1}/${recipients.length}  FAIL  ${r.email} - ${result.error}`,
        );
      } else {
        sent++;
        if (recipients.length <= 5 || i % 10 === 0) {
          console.log(
            `  ${i + 1}/${recipients.length}  OK    ${r.email} (id ${result.id})`,
          );
        }
      }
      if (recipients.length > 1 && i < recipients.length - 1) {
        await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
      }
    }

    console.log();
    console.log(`Done. attempted=${recipients.length} sent=${sent} failed=${failed}`);
    if (failures.length > 0) {
      console.log("First 10 failures:");
      failures.slice(0, 10).forEach((f) => console.log(`  ${f.email}: ${f.error}`));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
