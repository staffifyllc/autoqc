// Daily bug-triage digest cron. Pulls every BugReport with status NEW,
// gathers reporter + agency + property context, computes a suggested
// next action per bug, plus system-health counters (stuck PENDING
// photos, stuck PROCESSING properties), and emails Paul a single
// digest. The bug board stays the source of truth — this is just a
// scannable nudge so Paul can act on open bugs even on a busy week
// without checking the admin tab.
//
// Schedule: vercel.json hits this once a day at 12:00 UTC. Auth: same
// Bearer CRON_SECRET pattern as the existing crons.
//
// Dry run: ?dryRun=1 returns the digest payload as JSON instead of
// sending it. Useful for testing before each cadence change.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  renderTriageEmail,
  triageSubject,
  type TriageBug,
  type TriageHealth,
} from "@/lib/announcements/bugTriage";

const FROM = "AutoQC Triage <hello@autoqc.io>";
const TO = "pchareth@gmail.com";
const STUCK_PHOTO_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const STUCK_PROPERTY_AGE_MS = 60 * 60 * 1000; // 1h

function suggestedActionFor(bug: {
  severity: string;
  type: string;
  ageDays: number;
}): { text: string; tone: TriageBug["suggestedActionTone"] } {
  const sev = bug.severity.toUpperCase();
  if (sev === "CRITICAL") {
    return {
      text:
        bug.ageDays >= 1
          ? "Critical and aging. Reply or fix today."
          : "Critical. Reply within a few hours or escalate.",
      tone: "urgent",
    };
  }
  if (sev === "HIGH") {
    return bug.ageDays >= 2
      ? { text: "High severity aging past 2 days. Reply or close.", tone: "urgent" }
      : { text: "High severity. Triage today.", tone: "aging" };
  }
  if (bug.type.toUpperCase() === "FEATURE_REQUEST") {
    return {
      text: "Feature request. Acknowledge and add to roadmap. No code change needed today.",
      tone: "low",
    };
  }
  if (bug.ageDays >= 3) {
    return {
      text: "Aging past 3 days with no action. Reply, fix, or mark WONT_FIX.",
      tone: "aging",
    };
  }
  return {
    text: "Read, decide TRIAGED / IN_PROGRESS / FIXED / WONT_FIX.",
    tone: "normal",
  };
}

function extractPropertyId(pageUrl: string | null): string | null {
  if (!pageUrl) return null;
  // /dashboard/properties/<cuid>[/...]
  const m = pageUrl.match(/\/dashboard\/properties\/([a-z0-9]{20,})/i);
  return m ? m[1] : null;
}

async function sendDigestViaResend(args: {
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
      to: [TO],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) return { error: data?.message ?? `HTTP ${res.status}` };
  return { id: data.id };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1) Pull every NEW bug.
  const rawBugs = await prisma.bugReport.findMany({
    where: { status: "NEW" },
    orderBy: { createdAt: "asc" },
  });

  // 2) Hydrate each bug with reporter + agency + property context. Bugs
  // do NOT have an FK to User per the schema (reporterUserId is a
  // plain String), so we batch-query.
  const reporterIds = Array.from(new Set(rawBugs.map((b) => b.reporterUserId)));
  const reporters = reporterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reporterIds } },
        select: {
          id: true,
          email: true,
          name: true,
          agencies: {
            select: { agency: { select: { id: true, name: true, isAdmin: true } } },
            take: 1,
          },
        },
      })
    : [];
  const reporterById = new Map(reporters.map((u) => [u.id, u]));

  // Resolve property data per bug if pageUrl points at one.
  const propertyIds = Array.from(
    new Set(
      rawBugs
        .map((b) => extractPropertyId(b.pageUrl))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: {
          id: true,
          address: true,
          photoCount: true,
          photos: {
            select: { status: true },
          },
        },
      })
    : [];
  const propertyById = new Map(properties.map((p) => [p.id, p]));

  const bugs: TriageBug[] = rawBugs.map((b) => {
    const reporter = reporterById.get(b.reporterUserId);
    const agency = reporter?.agencies?.[0]?.agency;
    const propId = extractPropertyId(b.pageUrl);
    const prop = propId ? propertyById.get(propId) : null;
    const stuckCount = prop
      ? prop.photos.filter((p) => p.status === "PENDING").length
      : null;
    const ageDays = (Date.now() - b.createdAt.getTime()) / 86_400_000;
    const action = suggestedActionFor({
      severity: b.severity,
      type: b.type,
      ageDays,
    });
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      severity: b.severity,
      type: b.type,
      ageDays,
      reporterEmail: reporter?.email ?? "(unknown reporter)",
      reporterName: reporter?.name ?? null,
      agencyName: agency?.name ?? null,
      pageUrl: b.pageUrl,
      propertyAddress: prop?.address ?? null,
      propertyPhotoCount: prop?.photoCount ?? null,
      propertyStuckCount: stuckCount,
      suggestedAction: action.text,
      suggestedActionTone: action.tone,
    };
  });

  // 3) System health counters.
  const stuckCutoff = new Date(Date.now() - STUCK_PHOTO_AGE_MS);
  const propStuckCutoff = new Date(Date.now() - STUCK_PROPERTY_AGE_MS);

  const stuckPendingPhotos = await prisma.photo.count({
    where: {
      status: "PENDING",
      createdAt: { lt: stuckCutoff },
      property: { agency: { isAdmin: false } },
    },
  });

  const stuckProcessingProperties = await prisma.property.count({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: propStuckCutoff },
      agency: { isAdmin: false },
    },
  });

  const stuckAgencies = await prisma.photo.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: stuckCutoff },
      property: { agency: { isAdmin: false } },
    },
    select: { property: { select: { agencyId: true } } },
  });
  const agenciesWithStuckOver24h = new Set(
    stuckAgencies.map((p) => p.property.agencyId),
  ).size;

  const health: TriageHealth = {
    stuckPendingPhotos,
    stuckProcessingProperties,
    agenciesWithStuckOver24h,
  };

  const dateLabel = new Date().toISOString().slice(0, 10);
  const subject = triageSubject({
    bugCount: bugs.length,
    stuckPhotoCount: health.stuckPendingPhotos,
  });
  const { html, text } = renderTriageEmail({ bugs, health, dateLabel });

  if (dryRun) {
    return NextResponse.json({
      mode: "dryRun",
      subject,
      bugs: bugs.length,
      health,
      sampleBug: bugs[0] ?? null,
    });
  }

  // Always send to Paul, even when nothing is open — an "all clear"
  // confirms the cron is alive. If you find this noisy, gate by
  // (bugs.length > 0 || stuckPendingPhotos > 0) here.
  const result = await sendDigestViaResend({ subject, html, text });

  if ("error" in result) {
    console.error("[bug-triage] Resend failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    sent: true,
    resendId: result.id,
    bugCount: bugs.length,
    health,
  });
}
