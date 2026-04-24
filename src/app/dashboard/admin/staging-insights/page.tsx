"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sofa, TrendingDown, Sparkles } from "lucide-react";

type Summary = {
  previewCount: number;
  finalCount: number;
  conversionByPhoto: number;
  conversionByRender: number;
  previewCost: number;
  finalCost: number;
  totalCost: number;
  revenueDollars: number;
  grossMargin: number;
  abandonedPhotoCount: number;
  abandonedCost: number;
};
type StyleRow = {
  style: string;
  previews: number;
  finals: number;
  conversionRate: number;
};
type RoomTypeRow = {
  roomType: string;
  previews: number;
  finals: number;
  conversionRate: number;
};
type AgencyRow = {
  id: string;
  name: string;
  previews: number;
  finals: number;
  conversionRate: number;
  estCost: number;
  estRevenue: number;
  estMargin: number;
};
type DailyRow = { date: string; previews: number; finals: number };

type Data = {
  summary: Summary;
  styles: StyleRow[];
  roomTypes: RoomTypeRow[];
  agencies: AgencyRow[];
  daily: DailyRow[];
};

function money(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-red-300"
        : "text-foreground";
  return (
    <div className="panel p-4 rounded-xl border border-white/5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-xl font-semibold stat-num mt-1 ${toneClass}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

export default function StagingInsightsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/staging-insights")
      .then(async (r) => {
        if (!r.ok)
          throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Data) => setData(d))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (err)
    return (
      <div className="panel p-5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 text-sm">
        {err}
      </div>
    );
  if (!data) return null;

  const s = data.summary;
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.previews + d.finals));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to admin
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sofa className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Virtual Staging Insights</h1>
            <div className="text-[12px] text-muted-foreground">
              Preview-to-keeper conversion, style performance, and spend.
            </div>
          </div>
        </div>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Previews" value={s.previewCount} />
        <StatCard
          label="Keepers"
          value={s.finalCount}
          sub={pct(s.conversionByRender) + " of all renders"}
        />
        <StatCard
          label="Convert (by photo)"
          value={pct(s.conversionByPhoto)}
          sub={`${s.abandonedPhotoCount} abandoned`}
        />
        <StatCard
          label="Revenue"
          value={money(s.revenueDollars)}
          tone="positive"
        />
        <StatCard
          label="Gross margin"
          value={money(s.grossMargin)}
          tone={s.grossMargin >= 0 ? "positive" : "negative"}
          sub={money(s.totalCost) + " OpenAI"}
        />
      </div>

      {/* Abandoned-preview cost box */}
      {s.abandonedPhotoCount > 0 && (
        <div className="panel p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold">
                {s.abandonedPhotoCount} photos previewed but never purchased
              </div>
              <div className="text-[12px] text-muted-foreground mt-1">
                We spent about{" "}
                <span className="text-amber-200 font-semibold">
                  {money(s.abandonedCost)}
                </span>{" "}
                on OpenAI rendering previews that did not convert. If this
                climbs, consider dropping preview quality to{" "}
                <code className="text-[11px]">low</code> (~$0.01 each) or
                rate-limiting previews per photo.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily sparkline */}
      {data.daily.length > 0 && (
        <div className="panel p-5 rounded-2xl border border-white/5">
          <h2 className="text-sm font-semibold mb-3">Last 30 days</h2>
          <div className="flex items-end gap-1 h-28">
            {data.daily.map((d) => {
              const total = d.previews + d.finals;
              const height = (total / maxDaily) * 100;
              const finalPct = total > 0 ? (d.finals / total) * 100 : 0;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col justify-end min-w-[4px]"
                  title={`${d.date}: ${d.previews} previews, ${d.finals} keepers`}
                >
                  <div
                    className="w-full bg-amber-500/20 rounded-t-sm relative overflow-hidden"
                    style={{ height: `${height}%`, minHeight: total > 0 ? 2 : 0 }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500"
                      style={{ height: `${finalPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500/40 rounded-sm" />
              Previews
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-sm" />
              Keepers
            </span>
          </div>
        </div>
      )}

      {/* Per style */}
      <div className="panel p-5 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Style performance
        </h2>
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="text-left py-2">Style</th>
              <th className="text-right py-2">Previews</th>
              <th className="text-right py-2">Keepers</th>
              <th className="text-right py-2">Convert</th>
            </tr>
          </thead>
          <tbody>
            {data.styles.map((r) => (
              <tr key={r.style} className="border-b border-white/[0.03]">
                <td className="py-2 capitalize">{r.style.replace(/_/g, " ")}</td>
                <td className="py-2 text-right font-mono stat-num">
                  {r.previews}
                </td>
                <td className="py-2 text-right font-mono stat-num text-emerald-300">
                  {r.finals}
                </td>
                <td className="py-2 text-right font-mono stat-num">
                  {pct(r.conversionRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per room type */}
      <div className="panel p-5 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-3">Room type performance</h2>
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="text-left py-2">Room type</th>
              <th className="text-right py-2">Previews</th>
              <th className="text-right py-2">Keepers</th>
              <th className="text-right py-2">Convert</th>
            </tr>
          </thead>
          <tbody>
            {data.roomTypes.map((r) => (
              <tr key={r.roomType} className="border-b border-white/[0.03]">
                <td className="py-2 capitalize">
                  {r.roomType.replace(/_/g, " ")}
                </td>
                <td className="py-2 text-right font-mono stat-num">
                  {r.previews}
                </td>
                <td className="py-2 text-right font-mono stat-num text-emerald-300">
                  {r.finals}
                </td>
                <td className="py-2 text-right font-mono stat-num">
                  {pct(r.conversionRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per agency */}
      {data.agencies.length > 0 && (
        <div className="panel p-5 rounded-2xl border border-white/5">
          <h2 className="text-sm font-semibold mb-3">By agency</h2>
          <table className="w-full text-sm">
            <thead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-white/5">
                <th className="text-left py-2">Agency</th>
                <th className="text-right py-2">Previews</th>
                <th className="text-right py-2">Keepers</th>
                <th className="text-right py-2">Convert</th>
                <th className="text-right py-2">Cost</th>
                <th className="text-right py-2">Revenue</th>
                <th className="text-right py-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.agencies.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.03]">
                  <td className="py-2">
                    <Link
                      href={`/dashboard/admin/agencies/${r.id}`}
                      className="hover:text-foreground hover:underline underline-offset-2 decoration-white/20 transition"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right font-mono stat-num">
                    {r.previews}
                  </td>
                  <td className="py-2 text-right font-mono stat-num text-emerald-300">
                    {r.finals}
                  </td>
                  <td className="py-2 text-right font-mono stat-num">
                    {pct(r.conversionRate)}
                  </td>
                  <td className="py-2 text-right font-mono stat-num text-muted-foreground">
                    {money(r.estCost)}
                  </td>
                  <td className="py-2 text-right font-mono stat-num">
                    {money(r.estRevenue)}
                  </td>
                  <td
                    className={`py-2 text-right font-mono stat-num ${r.estMargin >= 0 ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {money(r.estMargin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
