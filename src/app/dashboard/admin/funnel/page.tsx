// Admin-only funnel report. Reads from the Event table populated by
// recordEvent / recordFirstEvent. Server component, no client JS.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const FUNNEL_STAGES: Array<{
  name: string;
  label: string;
  description: string;
}> = [
  {
    name: "signup_completed",
    label: "Signed up",
    description: "Completed onboarding flow",
  },
  {
    name: "first_property_created",
    label: "Created first property",
    description: "Filled in address, picked tier",
  },
  {
    name: "first_run_qc_attempted",
    label: "Tried to run QC",
    description: "Hit the run_qc endpoint at least once",
  },
  {
    name: "first_run_qc_blocked_402",
    label: "Blocked at payment",
    description: "Auto-QC returned 402 (no credits / no card)",
    isLeak: true,
  } as any,
];

interface StageData {
  name: string;
  label: string;
  description: string;
  isLeak?: boolean;
  count: number;
}

export default async function FunnelPage() {
  // Admin gate: same trick as the rest of /dashboard/admin/*. The
  // requireAgency call ensures we have a session; the isAdmin flag on
  // the agency is checked below.
  const session = await requireAgency();
  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId! },
    select: { isAdmin: true },
  });
  if (!agency?.isAdmin) redirect("/dashboard");

  // Aggregate counts of unique agencies that hit each event name.
  // We use distinct agencyId so multiple events from the same agency
  // count once at each stage.
  const counts: Record<string, number> = {};
  for (const stage of FUNNEL_STAGES) {
    const distinctRows = await prisma.event.findMany({
      where: { name: stage.name, agencyId: { not: null } },
      select: { agencyId: true },
      distinct: ["agencyId"],
    });
    counts[stage.name] = distinctRows.length;
  }

  // Top-line: total non-admin agencies (the funnel denominator).
  const totalAgencies = await prisma.agency.count({
    where: { isAdmin: false },
  });

  // Recent events for the live feed.
  const recent = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const stages: StageData[] = FUNNEL_STAGES.map((s: any) => ({
    name: s.name,
    label: s.label,
    description: s.description,
    isLeak: !!s.isLeak,
    count: counts[s.name] ?? 0,
  }));

  // Hand-roll the conversion arrows by walking adjacent pairs of
  // non-leak stages. Leak stages render alongside but don't advance.
  const mainStages = stages.filter((s) => !s.isLeak);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-3 font-mono uppercase tracking-wider"
        >
          <ArrowLeft className="w-3 h-3" />
          Admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Funnel</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Per-agency conversion through the first-property flow. Counts are
          distinct agencies that have hit each event at least once. Total
          non-admin agencies in DB: <span className="font-mono">{totalAgencies}</span>.
        </p>
      </div>

      {/* Main funnel */}
      <div className="space-y-2">
        {mainStages.map((s, i) => {
          const prev = i > 0 ? mainStages[i - 1].count : totalAgencies;
          const conv = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
          const drop = prev - s.count;
          return (
            <div
              key={s.name}
              className="rounded-md border border-border bg-[hsl(var(--surface-1))] p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {s.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-2xl font-semibold stat-num">
                    {s.count}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {conv}% from previous · {drop} dropped
                  </div>
                </div>
              </div>
              <div className="h-1 mt-3 rounded-full bg-[hsl(var(--surface-3))] overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${totalAgencies > 0 ? Math.min(100, (s.count / totalAgencies) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaks (events that represent friction, not progress) */}
      {stages.filter((s) => s.isLeak).map((s) => (
        <div
          key={s.name}
          className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-200">
                {s.label}
              </p>
              <p className="text-[12px] text-amber-200/70 mt-0.5">
                {s.description}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-2xl font-semibold stat-num text-amber-200">
                {s.count}
              </div>
              <div className="text-[11px] text-amber-200/60 font-mono">
                agencies
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Recent feed */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Recent events</h2>
        <div className="rounded-md border border-border bg-[hsl(var(--surface-1))] divide-y divide-border">
          {recent.length === 0 ? (
            <div className="p-3 text-[12px] text-muted-foreground">
              No events recorded yet.
            </div>
          ) : (
            recent.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 p-3 text-[12px] font-mono"
              >
                <span className="text-muted-foreground w-32 shrink-0">
                  {e.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                </span>
                <span className="font-semibold w-56 truncate shrink-0">
                  {e.name}
                </span>
                <span className="text-muted-foreground truncate flex-1">
                  agency={e.agencyId?.slice(-6) ?? "—"} user={e.userId?.slice(-6) ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
