"use client";

import { useEffect, useState } from "react";
import {
  Gift,
  Copy,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  AlertTriangle,
} from "lucide-react";

type ReferralCode = {
  code: string;
  shareUrl: string;
};

type ReferralRow = {
  id: string;
  inviteeEmail: string;
  status: "PENDING" | "SIGNED_UP" | "CREDITED" | "EXPIRED";
  createdAt: string;
  creditedAt: string | null;
  creditsEarned: number;
};

type Data = {
  code: ReferralCode | null;
  referrals: ReferralRow[];
  totalEarned: number;
};

const REWARD = 25;

export default function ReferPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/referrals");
      if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async () => {
    if (!data?.code?.shareUrl) return;
    await navigator.clipboard.writeText(data.code.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = emails
      .split(/[,\s\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (list.length === 0) {
      setError("Enter at least one valid email");
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/referrals/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: list }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Send failed");
      setSuccess(
        `Sent ${d.sent} invite${d.sent === 1 ? "" : "s"}.${
          d.skipped > 0
            ? ` Skipped ${d.skipped} (already invited or already a user).`
            : ""
        }`
      );
      setEmails("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-amber-300" />
          <h1 className="text-2xl font-bold">Refer &amp; earn</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Send AutoQC to a friend. They get{" "}
          <span className="text-foreground font-semibold">
            {REWARD} free credits
          </span>{" "}
          when they finish signing up. You get{" "}
          <span className="text-foreground font-semibold">
            {REWARD} free credits
          </span>{" "}
          the same moment. Both sides win, no waiting.
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

      {/* Stats + share link */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="panel p-4 rounded-xl border border-white/5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Credits earned
          </div>
          <div className="text-2xl font-semibold stat-num text-emerald-300 mt-1">
            {data?.totalEarned ?? 0}
          </div>
        </div>
        <div className="panel p-4 rounded-xl border border-white/5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Pending
          </div>
          <div className="text-2xl font-semibold stat-num mt-1">
            {data?.referrals.filter((r) => r.status === "PENDING" || r.status === "SIGNED_UP").length ?? 0}
          </div>
        </div>
        <div className="panel p-4 rounded-xl border border-white/5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Total invites
          </div>
          <div className="text-2xl font-semibold stat-num mt-1">
            {data?.referrals.length ?? 0}
          </div>
        </div>
      </div>

      {/* Share URL */}
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your link...
        </div>
      ) : data?.code ? (
        <div className="panel p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-transparent">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 mb-2">
            Your share link
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono truncate">
              {data.code.shareUrl}
            </code>
            <button
              onClick={copy}
              className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            Drop this in a DM, an email, a tweet — anywhere. Your friend
            signs up through it, you both get {REWARD} credits.
          </div>
        </div>
      ) : null}

      {/* Send invites */}
      <div className="panel p-5 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-amber-300" />
          Send invites by email
        </h2>
        <p className="text-[12px] text-muted-foreground mb-4">
          Paste up to 20 emails (separated by commas, spaces, or new lines).
          We&apos;ll send each one a friendly invite from you.
        </p>
        <form onSubmit={send} className="space-y-3">
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="friend1@example.com, friend2@example.com"
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            type="submit"
            disabled={sending || !emails.trim()}
            className="px-4 py-2 rounded-lg gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Send invites
              </>
            )}
          </button>
        </form>
      </div>

      {/* Referrals list */}
      {(data?.referrals?.length ?? 0) > 0 && (
        <div className="panel p-5 rounded-2xl border border-white/5">
          <h2 className="text-sm font-semibold mb-3">Your referrals</h2>
          <div className="space-y-1.5">
            {data!.referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-sm"
              >
                <div className="min-w-0 flex-1 truncate">{r.inviteeEmail}</div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.status === "CREDITED" && (
                    <span className="text-emerald-300 font-mono text-xs">
                      +{r.creditsEarned}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                      r.status === "CREDITED"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : r.status === "SIGNED_UP"
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : r.status === "EXPIRED"
                            ? "bg-white/5 text-muted-foreground border-white/10"
                            : "bg-amber-500/15 text-amber-200 border-amber-500/30"
                    }`}
                  >
                    {r.status === "CREDITED"
                      ? "Credited"
                      : r.status === "SIGNED_UP"
                        ? "Signed up"
                        : r.status === "EXPIRED"
                          ? "Expired"
                          : "Pending"}
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
