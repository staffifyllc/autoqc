// Daily cron: find agencies whose photos have been sitting in PENDING
// for over 24 hours, group by agency, and send a single recovery
// email per agency. Dedups via Agency.lastStuckRecoveryEmailAt so we
// don't blast the same agency every day; configured for at-most every
// 3 days per agency.
//
// Schedule: vercel.json hits this once a day. Auth: same Bearer
// CRON_SECRET pattern as the existing dropbox-autohdr cron.
//
// Email: src/lib/announcements/stuckRecovery.ts
// Trigger context (root cause): UploadContext.tsx auto-triggers
// run_qc after upload completes, but silently swallows the 402
// payment-required path with an alert(). Photos sit PENDING forever
// while the user thinks the upload "worked." This cron brings them
// back.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signUnsubscribeToken } from "@/lib/announcements/unsubscribeToken";
import {
  renderStuckRecoveryEmail,
  STUCK_RECOVERY_SUBJECT,
} from "@/lib/announcements/stuckRecovery";

const FROM = "Paul Chareth <hello@autoqc.io>";
const REPLY_TO = "pchareth@gmail.com";
const SITE_URL = "https://www.autoqc.io";

// Send at most every N days per agency to avoid blasting.
const DEDUP_WINDOW_DAYS = 3;

// Only flag photos that have been PENDING for at least this long.
// Anything younger is plausibly mid-upload and will resolve on its own.
const STUCK_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AgencyRecoveryBucket {
  agencyId: string;
  agencyName: string;
  ownerEmail: string;
  ownerName: string | null;
  ownerUserId: string;
  totalPending: number;
  hasPaymentMethod: boolean;
  creditBalance: number;
  properties: Array<{ id: string; address: string; pendingCount: number }>;
}

async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
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
  if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
  return { id: data.id };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // Allow a dryRun query param to test without sending.
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stuckCutoff = new Date(Date.now() - STUCK_AGE_MS);
  const dedupCutoff = new Date(
    Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Pull every PENDING photo older than 24h with the property + agency
  // chain we need for the email.
  const stuckPhotos = await prisma.photo.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: stuckCutoff },
    },
    select: {
      id: true,
      propertyId: true,
      property: {
        select: {
          id: true,
          address: true,
          isStandaloneStaging: true,
          status: true,
          agency: {
            select: {
              id: true,
              name: true,
              isAdmin: true,
              hasPaymentMethod: true,
              creditBalance: true,
              lastStuckRecoveryEmailAt: true,
              members: {
                where: { role: "owner" },
                select: {
                  user: {
                    select: { id: true, email: true, name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Group by agency, drop admin agencies, drop staging-only properties.
  const buckets = new Map<string, AgencyRecoveryBucket>();
  for (const p of stuckPhotos) {
    const prop = p.property;
    if (!prop) continue;
    if (prop.isStandaloneStaging) continue;
    const agency = prop.agency;
    if (!agency || agency.isAdmin) continue;

    // Skip agencies emailed within the dedup window.
    if (
      agency.lastStuckRecoveryEmailAt &&
      agency.lastStuckRecoveryEmailAt > dedupCutoff
    ) {
      continue;
    }

    // Pull the owner-role member for the to: address.
    const owner = agency.members[0]?.user;
    if (!owner?.email) continue;

    let bucket = buckets.get(agency.id);
    if (!bucket) {
      bucket = {
        agencyId: agency.id,
        agencyName: agency.name,
        ownerEmail: owner.email,
        ownerName: owner.name,
        ownerUserId: owner.id,
        totalPending: 0,
        hasPaymentMethod: agency.hasPaymentMethod,
        creditBalance: agency.creditBalance,
        properties: [],
      };
      buckets.set(agency.id, bucket);
    }
    let propEntry = bucket.properties.find((x) => x.id === prop.id);
    if (!propEntry) {
      propEntry = { id: prop.id, address: prop.address, pendingCount: 0 };
      bucket.properties.push(propEntry);
    }
    propEntry.pendingCount += 1;
    bucket.totalPending += 1;
  }

  const results: Array<{
    agencyId: string;
    email: string;
    sent: boolean;
    error?: string;
    properties: number;
    pending: number;
    skippedReason?: string;
  }> = [];

  for (const bucket of Array.from(buckets.values())) {
    const blocker =
      bucket.creditBalance <= 0 && !bucket.hasPaymentMethod
        ? "no credits and no payment method on file"
        : !bucket.hasPaymentMethod
          ? "no payment method on file for pay-as-you-go"
          : bucket.creditBalance <= 0
            ? "credit balance is empty"
            : "QC trigger failed earlier; one click resumes it";

    const token = signUnsubscribeToken(bucket.ownerUserId);
    const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${token}`;
    const { html, text } = renderStuckRecoveryEmail({
      recipientName: bucket.ownerName,
      unsubscribeUrl,
      siteUrl: SITE_URL,
      properties: bucket.properties,
      blocker,
    });

    if (dryRun) {
      results.push({
        agencyId: bucket.agencyId,
        email: bucket.ownerEmail,
        sent: false,
        skippedReason: "dryRun",
        properties: bucket.properties.length,
        pending: bucket.totalPending,
      });
      continue;
    }

    const result = await sendViaResend({
      to: bucket.ownerEmail,
      subject: STUCK_RECOVERY_SUBJECT,
      html,
      text,
    });
    if (result.error) {
      results.push({
        agencyId: bucket.agencyId,
        email: bucket.ownerEmail,
        sent: false,
        error: result.error,
        properties: bucket.properties.length,
        pending: bucket.totalPending,
      });
      continue;
    }

    // Mark the agency as emailed so the next run doesn't re-send.
    await prisma.agency.update({
      where: { id: bucket.agencyId },
      data: { lastStuckRecoveryEmailAt: new Date() },
    });

    results.push({
      agencyId: bucket.agencyId,
      email: bucket.ownerEmail,
      sent: true,
      properties: bucket.properties.length,
      pending: bucket.totalPending,
    });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    bucketed: buckets.size,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
