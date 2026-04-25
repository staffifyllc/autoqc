"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Handshake,
  Sparkles,
} from "lucide-react";

export default function AffiliatesPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("");
  const [reach, setReach] = useState("");
  const [why, setWhy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, audience, reach, why }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "Could not submit");
      }
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">AutoQC</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono uppercase tracking-wider mb-4">
            <Handshake className="w-3 h-3" />
            Application only
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            AutoQC Affiliate Program
          </h1>
          <p className="text-muted-foreground text-[15px] max-w-2xl">
            For real estate photo industry creators, operators, and educators.
            Send us photographers and agencies who'd benefit from AutoQC and
            earn a recurring revenue share on everything they pay.
          </p>
        </header>

        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          <div className="panel p-4 rounded-xl border border-white/5">
            <DollarSign className="w-4 h-4 text-emerald-300 mb-2" />
            <div className="text-sm font-semibold mb-0.5">20% recurring</div>
            <div className="text-[11px] text-muted-foreground">
              On every credit pack and PAYG charge for 12 months.
            </div>
          </div>
          <div className="panel p-4 rounded-xl border border-white/5">
            <Sparkles className="w-4 h-4 text-amber-300 mb-2" />
            <div className="text-sm font-semibold mb-0.5">Early features</div>
            <div className="text-[11px] text-muted-foreground">
              Affiliates get the first crack at every new beta.
            </div>
          </div>
          <div className="panel p-4 rounded-xl border border-white/5">
            <Handshake className="w-4 h-4 text-blue-300 mb-2" />
            <div className="text-sm font-semibold mb-0.5">Real partnership</div>
            <div className="text-[11px] text-muted-foreground">
              Direct access to Paul. We&apos;ll build with you, not just pay you.
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="panel p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Application received.</h2>
            <p className="text-sm text-muted-foreground">
              We read every one. Expect a reply from{" "}
              <a
                href="mailto:hello@autoqc.io"
                className="text-foreground underline"
              >
                hello@autoqc.io
              </a>{" "}
              within a few days.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="panel p-6 rounded-2xl border border-white/5 space-y-4"
          >
            <h2 className="text-lg font-semibold">Apply</h2>

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                What's your audience?
              </label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                required
                placeholder="Real estate photographers, agencies, MLS staff, ..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Where do you reach them? (links welcome)
              </label>
              <textarea
                value={reach}
                onChange={(e) => setReach(e.target.value)}
                required
                rows={3}
                placeholder="YouTube channel, newsletter, course, agency network, etc."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Why do you want to partner with AutoQC?
              </label>
              <textarea
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit application"
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
