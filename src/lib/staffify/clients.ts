/**
 * Read-only window into Staffify's talent-console roster. The talent
 * console writes its Monday Client Directory into Supabase table
 * `snapshot_clients`. We pull the active subset (non-archived,
 * non-discovery) so AutoQC can ask: "is this email a Staffify client?"
 *
 * Env (production, both required - missing them disables the sync
 * gracefully):
 *   STAFFIFY_SUPABASE_URL
 *   STAFFIFY_SUPABASE_SERVICE_KEY
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.STAFFIFY_SUPABASE_URL ?? "";
const KEY = process.env.STAFFIFY_SUPABASE_SERVICE_KEY ?? "";

const DISCOVERY_STAGE_ID = "discovery";

let _client: SupabaseClient | null = null;

function admin(): SupabaseClient | null {
  if (_client) return _client;
  if (!URL || !KEY) return null;
  _client = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "autoqc/staffify-sync" } },
  });
  return _client;
}

export type StaffifyClientEmail = {
  email: string;
  business: string | null;
};

/**
 * Pull every active Staffify client email. Returns a Set keyed by
 * lowercase email so the caller can do O(1) membership tests.
 *
 * Returns null when the Supabase credentials aren't configured. The
 * caller should treat that as "sync disabled" rather than "no clients."
 */
export async function fetchActiveStaffifyClientEmails(): Promise<{
  byEmail: Map<string, StaffifyClientEmail>;
  total: number;
} | null> {
  const sb = admin();
  if (!sb) return null;

  const { data, error } = await sb
    .from("snapshot_clients")
    .select(
      "contact_email, contact_email_override, stripe_email, stripe_email_override, business_name, business_name_override, stage, archived_at, recruiter_archived_at",
    )
    .is("archived_at", null)
    .is("recruiter_archived_at", null);

  if (error) {
    // Surface the error to the caller. Cron will log + email Paul.
    throw new Error(`staffify supabase query failed: ${error.message}`);
  }

  const byEmail = new Map<string, StaffifyClientEmail>();
  for (const row of data ?? []) {
    if (row.stage === DISCOVERY_STAGE_ID) continue;
    const email = (
      row.contact_email_override ??
      row.contact_email ??
      row.stripe_email_override ??
      row.stripe_email ??
      ""
    )
      .toString()
      .trim()
      .toLowerCase();
    if (!email) continue;
    const business =
      row.business_name_override ?? row.business_name ?? null;
    // First occurrence wins for dedup. Talent console roster shouldn't
    // have dupes but be defensive.
    if (!byEmail.has(email)) byEmail.set(email, { email, business });
  }

  return { byEmail, total: byEmail.size };
}

export function isStaffifySyncConfigured(): boolean {
  return Boolean(URL && KEY);
}
