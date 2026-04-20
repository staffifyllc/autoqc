"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";

type Order = {
  id: string;
  address: string;
  agency: string;
  client: string | null;
  tier: "STANDARD" | "PREMIUM";
  status: "PENDING" | "PROCESSING" | "REVIEW" | "APPROVED" | "PUSHED";
  photoCount: number;
  qcPassCount: number;
  qcFailCount: number;
  avgQcScore: number | null;
  pushedTo: string | null;
  pushedAt: string | null;
  createdAt: string;
};

type Response = {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const PAGE_SIZES = [25, 50, 100] as const;

function relTime(iso: string | null): string {
  if (!iso) return "—";
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

function statusTone(s: Order["status"]): string {
  switch (s) {
    case "APPROVED":
    case "PUSHED":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    case "PROCESSING":
      return "text-blue-300 bg-blue-500/10 border-blue-500/30";
    case "REVIEW":
      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
    case "PENDING":
    default:
      return "text-muted-foreground bg-[hsl(var(--surface-1))] border-border";
  }
}

export default function OrdersTab() {
  const [data, setData] = useState<Response | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(25);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/admin/orders?page=${page}&limit=${limit}`);
        if (res.status === 403) {
          if (!cancelled) setErr("forbidden");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Response;
        if (!cancelled) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page, limit]);

  if (err === "forbidden") {
    return (
      <div className="panel p-10 max-w-xl mx-auto text-center">
        <ShieldAlert className="w-10 h-10 text-amber-300 mx-auto mb-3" />
        <h1 className="text-xl font-semibold mb-2">Admin only</h1>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel p-10 text-center text-sm text-muted-foreground">
        Loading orders…
      </div>
    );
  }

  const showingFrom = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
  const showingTo = Math.min(data.page * data.limit, data.total);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium">Orders</h2>
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {data.total.toLocaleString()} total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Per page
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(1);
              }}
              className="bg-[hsl(var(--surface-1))] border border-border rounded px-2 py-1 text-xs font-mono"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 font-normal">Address</th>
                <th className="text-left px-3 py-2.5 font-normal">Agency</th>
                <th className="text-left px-3 py-2.5 font-normal">Tier</th>
                <th className="text-right px-3 py-2.5 font-normal">Photos</th>
                <th className="text-right px-3 py-2.5 font-normal">Pass / Fail</th>
                <th className="text-right px-3 py-2.5 font-normal">Avg score</th>
                <th className="text-left px-3 py-2.5 font-normal">Status</th>
                <th className="text-left px-3 py-2.5 font-normal">Delivered</th>
                <th className="text-left px-5 py-2.5 font-normal">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center text-muted-foreground">
                    No orders yet.
                  </td>
                </tr>
              )}
              {data.orders.map((o) => (
                <tr key={o.id} className="hover:bg-[hsl(var(--surface-2))]">
                  <td className="px-5 py-3">
                    <div className="font-medium truncate max-w-[260px]">{o.address}</div>
                    {o.client && (
                      <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[260px]">
                        {o.client}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 truncate max-w-[180px]">{o.agency}</td>
                  <td className="px-3 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {o.tier.toLowerCase()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono stat-num">
                    {o.photoCount}
                  </td>
                  <td className="px-3 py-3 text-right font-mono stat-num">
                    <span className="text-emerald-300">{o.qcPassCount}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-amber-300">{o.qcFailCount}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono stat-num">
                    {o.avgQcScore != null ? o.avgQcScore.toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${statusTone(
                        o.status
                      )}`}
                    >
                      {o.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[11px] font-mono text-muted-foreground">
                    {o.pushedTo ? `${o.pushedTo} · ${relTime(o.pushedAt)}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-[11px] font-mono text-muted-foreground">
                    {relTime(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {showingFrom}–{showingTo} of {data.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[hsl(var(--surface-2))]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="text-[11px] font-mono text-muted-foreground">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[hsl(var(--surface-2))]"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
