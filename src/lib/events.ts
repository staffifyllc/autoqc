// Funnel-instrumentation event recorder.
//
// Writes a row to the Event table. Best-effort: if the write fails we
// log and swallow rather than blocking the calling flow. Events are
// for analytics, not for product correctness.
//
// Naming convention: snake_case, verb_noun. Prefix lifecycle events
// with `first_` when they should fire only on the first occurrence
// per agency (the caller is responsible for the gating logic, this
// module just writes whatever you hand it).
//
// Read sites: src/app/dashboard/admin/funnel/page.tsx
//
// Standard event names in use:
//   signup_completed              — onboarding flow finished
//   first_property_created        — agency created its first property
//   first_upload_completed        — agency finished uploading photos for first time
//   first_run_qc_attempted        — first time the agency triggered run_qc
//   first_run_qc_blocked_402      — first time run_qc returned payment-required
//   first_property_approved       — first property reached APPROVED state
//   first_download                — first ZIP / Lightroom download

import { prisma } from "./db";

export type EventName =
  | "signup_completed"
  | "first_property_created"
  | "first_upload_completed"
  | "first_run_qc_attempted"
  | "first_run_qc_blocked_402"
  | "first_property_approved"
  | "first_download"
  | (string & {});

interface RecordEventArgs {
  userId?: string | null;
  agencyId?: string | null;
  name: EventName;
  properties?: Record<string, unknown>;
}

export async function recordEvent(args: RecordEventArgs): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        userId: args.userId ?? null,
        agencyId: args.agencyId ?? null,
        name: args.name,
        properties: args.properties as any,
      },
    });
  } catch (err) {
    // Never let analytics writes break the calling flow.
    console.error(`[events] failed to record ${args.name}:`, err);
  }
}

// Helper for the very common "fire only the first time per agency"
// pattern. Returns true if the event was new and got written, false
// if the agency already had a row with this name. Use when you want
// the "first_*" events to dedupe themselves.
export async function recordFirstEvent(
  args: RecordEventArgs & { agencyId: string },
): Promise<boolean> {
  try {
    const existing = await prisma.event.findFirst({
      where: { agencyId: args.agencyId, name: args.name },
      select: { id: true },
    });
    if (existing) return false;
    await prisma.event.create({
      data: {
        userId: args.userId ?? null,
        agencyId: args.agencyId,
        name: args.name,
        properties: args.properties as any,
      },
    });
    return true;
  } catch (err) {
    console.error(`[events] failed to record first-event ${args.name}:`, err);
    return false;
  }
}
