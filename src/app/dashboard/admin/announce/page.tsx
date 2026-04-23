"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  Mail,
  Eye,
} from "lucide-react";

type PreviewData = {
  subject: string;
  html: string;
  eligibleCount: number;
};

type SendResult = {
  mode: "test" | "all";
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
};

export default function AdminAnnouncePage() {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sending, setSending] = useState<"test" | "all" | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    fetch("/api/admin/announcements/preview")
      .then(async (r) => {
        if (r.status === 403) throw new Error("Admin access required");
        if (!r.ok) throw new Error("Could not load preview");
        return r.json();
      })
      .then((d: PreviewData) => setData(d))
      .catch((e) => setLoadErr(e.message));
  }, []);

  const send = async (mode: "test" | "all") => {
    setSending(mode);
    setSendErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/announcements/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Send failed");
      }
      setResult(body);
      if (mode === "all") setConfirmAll(false);
    } catch (e: any) {
      setSendErr(e.message);
    } finally {
      setSending(null);
    }
  };

  if (loadErr) {
    return (
      <div className="p-8 text-sm text-red-300 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {loadErr}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Rendering preview...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="w-5 h-5 text-[hsl(var(--primary))]" />
          Announcements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preview the What's New email and send it to the opted-in user list.
        </p>
      </div>

      {/* Sending domain warning */}
      <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-200 text-xs flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-px shrink-0" />
        <div>
          <div className="font-semibold mb-1">Sender domain note</div>
          <div>
            Resend is currently configured to send as
            <code className="mx-1 px-1.5 py-0.5 bg-black/30 rounded">
              autoqc@recruiting.gostaffify.com
            </code>
            because <code className="mx-1 px-1.5 py-0.5 bg-black/30 rounded">autoqc.io</code>{" "}
            is not domain-verified in Resend yet. A blast from an unfamiliar
            subdomain lands in more spam folders. Verify the domain first if you
            want best deliverability.
          </div>
        </div>
      </div>

      {/* Metadata + actions */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-white/10 bg-[hsl(var(--surface-1))]">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <Users className="w-3.5 h-3.5" />
            Eligible recipients
          </div>
          <div className="text-2xl font-bold">{data.eligibleCount}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Users with marketingOptIn = true.
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-[hsl(var(--surface-1))]">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <Mail className="w-3.5 h-3.5" />
            Subject
          </div>
          <div className="text-sm font-medium leading-snug">
            {data.subject}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.subject.length} characters
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-[hsl(var(--surface-1))] flex flex-col justify-center">
          <button
            onClick={() => send("test")}
            disabled={!!sending}
            className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending === "test" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending test...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" /> Send test to me
              </>
            )}
          </button>
          {confirmAll ? (
            <div className="space-y-2">
              <button
                onClick={() => send("all")}
                disabled={!!sending}
                className="w-full px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending === "all" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending to{" "}
                    {data.eligibleCount}...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Confirm: blast {data.eligibleCount}
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirmAll(false)}
                disabled={!!sending}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAll(true)}
              disabled={!!sending || data.eligibleCount === 0}
              className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--primary))] text-black font-medium hover:opacity-90 transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Send to all {data.eligibleCount}
            </button>
          )}
        </div>
      </div>

      {/* Result / error panel */}
      {sendErr && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {sendErr}
        </div>
      )}
      {result && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 text-green-200 text-sm">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <CheckCircle2 className="w-4 h-4" />
            {result.mode === "test" ? "Test send complete" : "Blast complete"}
          </div>
          <div className="text-xs">
            Attempted {result.attempted}. Sent {result.sent}. Failed{" "}
            {result.failed}.
          </div>
          {result.failures.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="font-semibold mb-1 text-red-200">First failures:</div>
              <ul className="list-disc pl-5 space-y-0.5 text-red-200/80">
                {result.failures.map((f, i) => (
                  <li key={i}>
                    {f.email}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Email preview */}
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Preview
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden bg-black">
          <iframe
            srcDoc={data.html}
            className="w-full"
            style={{ height: "980px", border: 0, background: "#07090c" }}
            sandbox="allow-same-origin"
            title="Email preview"
          />
        </div>
      </div>
    </div>
  );
}
