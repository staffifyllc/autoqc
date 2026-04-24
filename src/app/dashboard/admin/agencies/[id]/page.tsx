"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  User,
  Phone,
  Globe,
  MapPin,
  Users,
  CalendarClock,
  Coins,
  CreditCard,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type Data = {
  agency: any;
  members: any[];
  transactions: any[];
  properties: any[];
  staging: { previews: number; finals: number; conversionRate: number };
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="panel p-4 rounded-xl border border-white/5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold stat-num mt-1">{value}</div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 mt-1 text-muted-foreground shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground break-words">
          {value ?? <span className="text-muted-foreground">—</span>}
        </div>
      </div>
    </div>
  );
}

export default function AgencyDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/agencies/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Data) => setData(d))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }
  if (err) {
    return (
      <div className="panel p-5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 text-sm">
        {err}
      </div>
    );
  }
  if (!data) return null;

  const a = data.agency;

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
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{a.name}</h1>
            <div className="text-[12px] text-muted-foreground font-mono">
              {a.id} · joined {fmtDate(a.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Credit balance" value={a.creditBalance} />
        <StatCard
          label="Lifetime paid"
          value={a.totalCreditsPurchased}
          sub={a.hasPaymentMethod ? "Card on file" : "No card"}
        />
        <StatCard label="Properties" value={a.propertyCount} />
        <StatCard
          label="Staging previews"
          value={data.staging.previews}
          sub={`${(data.staging.conversionRate * 100).toFixed(0)}% convert`}
        />
        <StatCard label="Staging keepers" value={data.staging.finals} />
      </div>

      {/* Signup details */}
      <div className="panel p-5 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Signup details
        </h2>
        <div className="grid md:grid-cols-2 gap-x-8">
          <div>
            <Field icon={Building2} label="Agency" value={a.name} />
            <Field
              icon={Globe}
              label="Website"
              value={
                a.website ? (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline"
                  >
                    {a.website}
                  </a>
                ) : null
              }
            />
            <Field icon={Phone} label="Phone" value={a.phone} />
            <Field
              icon={MapPin}
              label="Location"
              value={
                a.addressCity || a.addressState
                  ? `${a.addressCity ?? ""}${a.addressCity && a.addressState ? ", " : ""}${a.addressState ?? ""}`
                  : null
              }
            />
            <Field icon={Users} label="Team size" value={a.teamSize} />
          </div>
          <div>
            <Field
              icon={CalendarClock}
              label="Properties / month"
              value={a.propertiesMonth}
            />
            <Field
              icon={CalendarClock}
              label="Years in business"
              value={a.yearsInBusiness}
            />
            <Field
              label="Service types"
              value={
                a.serviceTypes?.length
                  ? a.serviceTypes.join(", ")
                  : null
              }
            />
            <Field
              label="Current platforms"
              value={
                a.currentPlatforms?.length
                  ? a.currentPlatforms.join(", ")
                  : null
              }
            />
            <Field
              label="Onboarding"
              value={
                a.onboardingComplete ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <XCircle className="w-3.5 h-3.5" /> Incomplete
                  </span>
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="panel p-5 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          Members ({data.members.length})
        </h2>
        <div className="space-y-3">
          {data.members.map((m) => (
            <div
              key={m.user.id}
              className="grid md:grid-cols-2 gap-x-8 p-3 rounded-lg bg-white/[0.02] border border-white/5"
            >
              <div>
                <Field icon={User} label="Name" value={m.user.name} />
                <Field label="Email" value={m.user.email} />
                <Field icon={Phone} label="Phone" value={m.user.phone} />
              </div>
              <div>
                <Field
                  label="Role"
                  value={`${m.role} · ${m.user.role ?? "—"}`}
                />
                <Field
                  label="Referral source"
                  value={m.user.referralSource}
                />
                <Field
                  label="Marketing opt-in"
                  value={m.user.marketingOptIn ? "Yes" : "No"}
                />
                <Field
                  label="Joined"
                  value={fmtDate(m.joinedAt)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent properties */}
      {data.properties.length > 0 && (
        <div className="panel p-5 rounded-2xl border border-white/5">
          <h2 className="text-sm font-semibold mb-3">
            Recent properties ({a.propertyCount} total)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 pr-3">Address</th>
                  <th className="text-left py-2 px-3">Tier</th>
                  <th className="text-right py-2 px-3">Photos</th>
                  <th className="text-right py-2 px-3">Pass / Fail</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-right py-2 pl-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.properties.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-3 truncate max-w-[260px]">
                      {p.address}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {p.tier}
                    </td>
                    <td className="py-2 px-3 text-right font-mono stat-num">
                      {p.photoCount}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs">
                      <span className="text-emerald-300">{p.qcPassCount}</span>
                      {" / "}
                      <span className="text-red-300">{p.qcFailCount}</span>
                    </td>
                    <td className="py-2 px-3 text-xs">{p.status}</td>
                    <td className="py-2 pl-3 text-right text-[11px] font-mono text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent credit transactions */}
      {data.transactions.length > 0 && (
        <div className="panel p-5 rounded-2xl border border-white/5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            Recent credit activity ({a.transactionCount} total)
          </h2>
          <div className="space-y-1.5">
            {data.transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-block w-[56px] text-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                      t.type === "PURCHASE"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : t.type === "USAGE"
                          ? "bg-white/5 text-muted-foreground border border-white/10"
                          : t.type === "REFUND"
                            ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            : t.type === "PROMO"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : "bg-white/5 text-muted-foreground border border-white/10"
                    }`}
                  >
                    {t.type}
                  </span>
                  <div className="text-sm truncate">{t.description}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-mono stat-num ${t.amount > 0 ? "text-emerald-300" : t.amount < 0 ? "text-muted-foreground" : ""}`}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
