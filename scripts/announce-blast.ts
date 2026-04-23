/**
 * One-off announcement sender. Loads opted-in users from prod DB,
 * renders the What's New email, signs per-user unsubscribe tokens,
 * and sends each via Resend REST API.
 *
 * Usage:
 *   npx tsx scripts/announce-blast.ts --count          (dry-run count)
 *   npx tsx scripts/announce-blast.ts --mode=test      (send to one address)
 *   npx tsx scripts/announce-blast.ts --mode=all       (send to everyone opted in)
 *
 * Env (pulled from .env.local / process env):
 *   DATABASE_URL, NEXTAUTH_SECRET, RESEND_API_KEY
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { renderWhatsNewEmail, WHATS_NEW_SUBJECT } from "../src/lib/announcements/whatsNew";
import { signUnsubscribeToken } from "../src/lib/announcements/unsubscribeToken";

const FROM = "AutoQC <hello@autoqc.io>";
const SITE_URL = "https://www.autoqc.io";
const SEND_DELAY_MS = 150;

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
      reply_to: "pchareth@gmail.com",
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) {
    return { error: data?.message ?? `HTTP ${res.status}` };
  }
  return { id: data.id };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const modeArg = [...args].find((a) => a.startsWith("--mode="));
  const mode = modeArg?.split("=")[1] ?? (args.has("--count") ? "count" : "");
  if (!mode) {
    console.error(
      "Pick one: --count, --mode=test, or --mode=all. --mode=test optionally takes --to=you@example.com"
    );
    process.exit(1);
  }
  const toArg = [...args].find((a) => a.startsWith("--to="));
  const testTo = toArg?.split("=")[1];

  const prisma = new PrismaClient();
  try {
    let recipients: Array<{ id: string; email: string; name: string | null }>;

    if (mode === "count") {
      const count = await prisma.user.count({
        where: { marketingOptIn: true, email: { not: "" } },
      });
      console.log(`Opted-in recipients: ${count}`);
      return;
    }

    if (mode === "test") {
      if (testTo) {
        recipients = [{ id: "preview", email: testTo, name: "Test" }];
      } else {
        // Default: send to the first admin we find.
        const adminMember = await prisma.agencyMember.findFirst({
          where: { agency: { isAdmin: true } },
          select: { user: { select: { id: true, email: true, name: true } } },
        });
        if (!adminMember?.user?.email) {
          console.error(
            "No admin user found. Pass --to=you@example.com explicitly."
          );
          process.exit(1);
        }
        recipients = [adminMember.user];
      }
    } else if (mode === "all") {
      recipients = await prisma.user.findMany({
        where: { marketingOptIn: true, email: { not: "" } },
        select: { id: true, email: true, name: true },
      });
    } else {
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
    }

    console.log(
      `[${mode}] Sending to ${recipients.length} recipient(s) from ${FROM}`
    );
    let sent = 0;
    let failed = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const tokenSubject = r.id === "preview" ? "preview" : r.id;
      const token = signUnsubscribeToken(tokenSubject);
      const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${token}`;
      const { html, text } = renderWhatsNewEmail({
        recipientName: r.name,
        unsubscribeUrl,
        siteUrl: SITE_URL,
      });
      const result = await sendViaResend({
        to: r.email,
        subject: WHATS_NEW_SUBJECT,
        html,
        text,
      });
      if (result.error) {
        failed++;
        failures.push({ email: r.email, error: result.error });
        console.log(
          `  ${i + 1}/${recipients.length}  FAIL  ${r.email} - ${result.error}`
        );
      } else {
        sent++;
        if (recipients.length <= 5 || i % 10 === 0) {
          console.log(
            `  ${i + 1}/${recipients.length}  OK    ${r.email} (id ${result.id})`
          );
        }
      }
      if (recipients.length > 1 && i < recipients.length - 1) {
        await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
      }
    }

    console.log();
    console.log(
      `Done. attempted=${recipients.length} sent=${sent} failed=${failed}`
    );
    if (failures.length > 0) {
      console.log("First 10 failures:");
      failures
        .slice(0, 10)
        .forEach((f) => console.log(`  ${f.email}: ${f.error}`));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
