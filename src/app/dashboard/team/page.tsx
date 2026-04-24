"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Shield,
} from "lucide-react";

type Member = {
  id: string;
  userId: string;
  role: string;
  isSelf: boolean;
  pending: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    phone: string | null;
    passwordSetAt: string | null;
    createdAt: string;
  };
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const load = async () => {
    try {
      const r = await fetch("/api/agency/members");
      if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
      const d = await r.json();
      setMembers(d.members ?? []);
      setCallerRole(d.callerRole ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/agency/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Invite failed");
      setSuccess(`${email} invited. We just emailed them a link to set their password.`);
      setEmail("");
      setFirstName("");
      setLastName("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const remove = async (userId: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from the team?`)) return;
    setRemoving(userId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/agency/members?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Remove failed (${res.status})`);
      }
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemoving(null);
    }
  };

  const isOwner = callerRole === "owner";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Team</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Give teammates, VAs, or editors access to your AutoQC account. Each
          person gets their own login.
        </p>
      </div>

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Invite form (owners only) */}
      {isOwner && (
        <div className="panel p-5 rounded-2xl border border-white/5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-amber-300" />
            Invite a teammate
          </h2>
          <p className="text-[12px] text-muted-foreground mb-4">
            We&apos;ll email them a link to set their password and log in.
            The link expires in 60 minutes.
          </p>
          <form onSubmit={invite} className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">
                  First name (optional)
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">
                  Last name (optional)
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={inviting || !email}
              className="px-4 py-2 rounded-lg gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {inviting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending invite...
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  Send invite
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Member list */}
      <div className="panel p-5 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-3">
          Current members ({members.length})
        </h2>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : members.length === 0 ? (
          <div className="text-sm text-muted-foreground">No members yet.</div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const displayName =
                m.user.name ??
                [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") ??
                m.user.email;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{displayName}</span>
                      {m.role === "owner" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-200 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                          <Shield className="w-3 h-3" />
                          Owner
                        </span>
                      )}
                      {m.isSelf && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          You
                        </span>
                      )}
                      {m.pending && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-blue-200 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3" />
                          Pending invite
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {m.user.email}
                      {m.user.phone ? ` · ${m.user.phone}` : ""}
                    </div>
                  </div>
                  {isOwner && !m.isSelf && m.role !== "owner" && (
                    <button
                      onClick={() => remove(m.userId, displayName)}
                      disabled={removing === m.userId}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {removing === m.userId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
