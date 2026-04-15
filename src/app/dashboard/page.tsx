"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Home,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  Plus,
  Coins,
  Camera,
  Palette,
  Plug,
  Activity,
} from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function DashboardPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    autoFixed: 0,
    flagged: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => setCredits(data.balance ?? 0))
      .catch(() => setCredits(0));

    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => {
        const props = data.properties || [];
        // This-month filter
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const monthly = props.filter(
          (p: any) => new Date(p.createdAt) >= start
        );
        setStats({
          total: monthly.length,
          autoFixed: props.filter((p: any) => p.status === "APPROVED").length,
          flagged: props.filter((p: any) => p.status === "REVIEW").length,
        });
        setRecent(props.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  const statTiles = [
    {
      label: "Credits",
      value: credits === null ? "--" : credits.toLocaleString(),
      icon: Coins,
      hint: "available",
    },
    {
      label: "Properties",
      value: stats.total.toString(),
      icon: Home,
      hint: "this month",
    },
    {
      label: "Auto-Fixed",
      value: stats.autoFixed.toString(),
      icon: Zap,
      hint: "approved",
    },
    {
      label: "Flagged",
      value: stats.flagged.toString(),
      icon: AlertTriangle,
      hint: "needs review",
    },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger}>
      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="flex items-end justify-between mb-8"
      >
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        </div>
        <Link
          href="/dashboard/properties?new=true"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          New Property
        </Link>
      </motion.div>

      {/* Stat row */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border mb-8">
        {statTiles.map((s) => (
          <div
            key={s.label}
            className="bg-[hsl(var(--surface-2))] p-5 hairline-top relative group hover:bg-[hsl(var(--surface-3))] transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-mono stat-num font-semibold text-foreground">
                {s.value}
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                {s.hint}
              </span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Recent + Quick Actions */}
      <div className="grid grid-cols-3 gap-5">
        {/* Recent */}
        <motion.div variants={fadeUp} className="col-span-2 panel hairline-top">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="font-medium text-sm">Recent activity</h2>
            </div>
            <Link
              href="/dashboard/properties"
              className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-lg border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center mb-4 dot-pattern">
                <Home className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium">No properties yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Upload your first property to see QC results here.
              </p>
              <Link
                href="/dashboard/properties?new=true"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-90 transition"
              >
                <Plus className="w-3 h-3" />
                Add property
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((p: any) => {
                const score =
                  p.totalQcScore !== null && p.totalQcScore !== undefined
                    ? Math.round(p.totalQcScore)
                    : null;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/properties/${p.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-[hsl(var(--surface-3))] transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-md border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center shrink-0">
                        <Home className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.address}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {p.photoCount} photos
                          {p.client?.clientName ? ` · ${p.client.clientName}` : ""}
                        </p>
                      </div>
                      {score !== null && (
                        <div className="text-right">
                          <span className="font-mono text-sm stat-num font-semibold">
                            {score}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            /100
                          </span>
                        </div>
                      )}
                      <StatusPill status={p.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={fadeUp} className="panel hairline-top p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="font-medium text-sm">Quick actions</h2>
          </div>

          <div className="space-y-1">
            {[
              {
                label: "Upload property",
                href: "/dashboard/properties?new=true",
                icon: Camera,
                desc: "Start a new QC run",
                kbd: "P",
              },
              {
                label: "Create style profile",
                href: "/dashboard/profiles?new=true",
                icon: Palette,
                desc: "Define your photo standard",
                kbd: "S",
              },
              {
                label: "Connect platform",
                href: "/dashboard/integrations",
                icon: Plug,
                desc: "Set up delivery push",
                kbd: "I",
              },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 px-2.5 py-2 -mx-2.5 rounded-md hover:bg-[hsl(var(--surface-3))] transition-colors group"
              >
                <div className="w-7 h-7 rounded-md border border-border bg-[hsl(var(--surface-1))] flex items-center justify-center group-hover:border-white/15 transition-colors">
                  <action.icon
                    className="w-3.5 h-3.5 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-tight">
                    {action.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {action.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* QC score gauge */}
          <div className="pt-3 mt-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Avg QC Score
              </p>
              <span className="text-[10px] font-mono text-muted-foreground/70">
                30d
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-mono stat-num font-semibold">
                --
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-[hsl(var(--surface-1))] overflow-hidden">
              <div className="h-full w-0 rounded-full bg-primary transition-all duration-1000" />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    PENDING: { label: "Pending", tone: "text-muted-foreground bg-[hsl(var(--surface-1))]" },
    PROCESSING: { label: "Running", tone: "text-blue-300 bg-blue-500/10" },
    REVIEW: { label: "Review", tone: "text-amber-300 bg-amber-500/10" },
    APPROVED: { label: "Approved", tone: "text-emerald-300 bg-emerald-500/10" },
    PUSHED: { label: "Delivered", tone: "text-violet-300 bg-violet-500/10" },
  };
  const c = map[status] || map.PENDING;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${c.tone}`}
    >
      {c.label}
    </span>
  );
}
