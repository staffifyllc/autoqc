"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Home,
  Image as ImageIcon,
  DollarSign,
  TrendingUp,
  Clock,
  ShieldAlert,
} from "lucide-react";

type Row = {
  id: string;
  name: string;
  createdAt: string;
  lastActive: string | null;
  propertyCount: number;
  memberCount: number;
  creditBalance: number;
  totalCreditsPurchased: number;
  billingMode: string;
  defaultTier: string;
  isAdmin: boolean;
  primaryEmail: string | null;
  primaryName: string | null;
};

type Event = {
  kind: "transaction" | "property";
  at: string;
  agency: string;
  detail: string;
};

type Data = {
  stats: {
    totalAgencies: number;
    totalProperties: number;
    totalPhotos: number;
    propsLast7: number;
    propsLast30: number;
    signupsLast7: number;
    signupsLast30: number;
    activeLast7: number;
    activeLast30: number;
    revenueCents: number;
    creditsPurchased: number;
  };
  agencies: Row[];
  events: Event[];
  generatedAt: string;
};

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function status(r: Row): { label: string; tone: string } {
  const signedUp = new Date(r.createdAt);
  const last = r.lastActive ? new Date(r.lastActive) : null;
  const days = last ? (Date.now() - last.getTime()) / 86_400_000 : Infinity;
  if (r.totalCreditsPurchased > 0 && days <= 30)
    return {
      label: "paying",
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    };
  if (r.propertyCount > 0 && days <= 7)
    return {
      label: "active",
      tone: "text-blue-300 bg-blue-500/10 border-blue-500/30",
    };
  if (r.propertyCount === 0 && Date.now() - signedUp.getTime() < 7 * 86_400_000)
    return {
      label: "new",
      tone: "text-primary bg-primary/10 border-primary/30",
    };
  if (r.propertyCount === 0)
    return {
      label: "signed up, idle",
      tone: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    };
  return {
    label: "lapsed",
    tone: "text-muted-foreground bg-[hsl(var(--surface-1))] border-border",
  };
}

export default function AdminUsagePage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/usage");
        if (res.status === 403) {
          setErr("forbidden");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Data;
        setData(json);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 20_000);
    return () => clearInterval(interval);
  }, []);

  if (err === "forbidden") {
    return (
      <div className="panel p-10 max-w-xl mx-auto text-center">
        <ShieldAlert className="w-10 h-10 text-amber-300 mx-auto mb-3" />
        <h1 className="text-xl font-semibold mb-2">Admin only</h1>
        <p className="text-sm text-muted-foreground">
          This page is only visible to accounts marked as admin. If that should
          be you, set <code className="text-primary font-mono">isAdmin=true</code> on
          your Agency row.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel p-10 text-center text-sm text-muted-foreground">
        Loading usage data…
      </div>
    );
  }

  const s = data.stats;
  const revenueDollars = (s.revenueCents / 100).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            WORKSPACE · ADMIN
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Platform usage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who has signed up and who is actually using AutoQC. Live, refreshes
            every 20 seconds.
          </p>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground">
          <Clock className="w-3 h-3 inline mr-1" />
          Updated {relTime(data.generatedAt)}
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-4 h-4 text-primary" />}
          label="Total agencies"
          value={s.totalAgencies.toString()}
          sub={`+${s.signupsLast7} last 7d · +${s.signupsLast30} last 30d`}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          label="Active agencies"
          value={s.activeLast7.toString()}
          sub={`${s.activeLast30} active last 30d`}
        />
        <StatCard
          icon={<Home className="w-4 h-4 text-primary" />}
          label="Properties"
          value={s.totalProperties.toString()}
          sub={`+${s.propsLast7} last 7d · +${s.propsLast30} last 30d`}
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          label="Revenue"
          value={`$${revenueDollars}`}
          sub={`${s.creditsPurchased} credits purchased`}
        />
      </div>

      {/* Agencies table */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium">Agencies</h2>
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {data.agencies.length} shown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 font-normal">Agency</th>
                <th className="text-left px-3 py-2.5 font-normal">Contact</th>
                <th className="text-right px-3 py-2.5 font-normal">Props</th>
                <th className="text-right px-3 py-2.5 font-normal">Credits</th>
                <th className="text-right px-3 py-2.5 font-normal">Spent</th>
                <th className="text-left px-3 py-2.5 font-normal">Joined</th>
                <th className="text-left px-3 py-2.5 font-normal">Last active</th>
                <th className="text-left px-5 py-2.5 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.agencies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-muted-foreground">
                    No agencies yet.
                  </td>
                </tr>
              )}
              {data.agencies.map((r) => {
                const st = status(r);
                return (
                  <tr key={r.id} className="hover:bg-[hsl(var(--surface-2))]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/admin/agencies/${r.id}`}
                        className="font-medium hover:text-foreground hover:underline underline-offset-2 decoration-white/20 transition"
                      >
                        {r.name}
                      </Link>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {r.defaultTier} · {r.billingMode.toLowerCase()}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-[13px] truncate max-w-[180px]">
                        {r.primaryName || "—"}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                        {r.primaryEmail || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono stat-num">
                      {r.propertyCount}
                    </td>
                    <td className="px-3 py-3 text-right font-mono stat-num">
                      {r.creditBalance}
                    </td>
                    <td className="px-3 py-3 text-right font-mono stat-num">
                      {r.totalCreditsPurchased}
                    </td>
                    <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground">
                      {relTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground">
                      {relTime(r.lastActive)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${st.tone}`}
                      >
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent activity */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Recent activity</h2>
        </div>
        <ul className="divide-y divide-border">
          {data.events.length === 0 && (
            <li className="px-5 py-4 text-center text-sm text-muted-foreground">
              No activity yet.
            </li>
          )}
          {data.events.map((e, i) => (
            <li
              key={i}
              className="px-5 py-2.5 flex items-center gap-3 text-sm"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  e.kind === "transaction" ? "bg-emerald-400" : "bg-primary"
                }`}
              />
              <span className="font-medium">{e.agency}</span>
              <span className="text-muted-foreground">{e.detail}</span>
              <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                {relTime(e.at)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Vercel traffic callout */}
      <div className="panel p-5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Traffic to autoqc.io
        </p>
        <p className="text-sm">
          Visitor numbers, top pages, and referrers live in the Vercel
          dashboard under Analytics.{" "}
          <Link
            href="https://vercel.com/staffifyllcs-projects/autoqc/analytics"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Open analytics →
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="panel p-4 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {props.label}
        </p>
        {props.icon}
      </div>
      <p className="text-2xl font-mono stat-num font-semibold">{props.value}</p>
      <p className="text-[11px] font-mono text-muted-foreground">{props.sub}</p>
    </div>
  );
}
