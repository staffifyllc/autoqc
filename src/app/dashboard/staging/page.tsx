"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sofa,
  Plus,
  Loader2,
  ArrowRight,
  Home,
  Sparkles,
  Clock,
} from "lucide-react";
import { STAGING_STYLES } from "@/lib/staging";

type StagingSession = {
  id: string;
  address: string;
  createdAt: string;
  photoCount: number;
  photosDone: number;
  photosRemaining: number;
};

export default function VirtualStagingPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StagingSession[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/staging/session")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]));
  }, []);

  const startSession = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/staging/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.property?.id) {
        throw new Error(data.error ?? "Could not start");
      }
      router.push(`/dashboard/properties/${data.property.id}`);
    } catch (e) {
      setCreating(false);
      alert("Could not start a staging session. Try again.");
    }
  };

  return (
    <div className="max-w-5xl space-y-10">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Sofa className="w-4 h-4 text-amber-300" />
          </div>
          <h1 className="text-2xl font-bold">Virtual Staging</h1>
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
            Beta
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Drop empty rooms, pick a style, and get photorealistic staged
          renders in seconds. Architecture preserved exactly. Preview is
          free. Keep renders you love for $3 each.
        </p>
      </div>

      {/* Start CTA */}
      <div className="panel p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-transparent">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Start a new session</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Create a session, upload your empty rooms, and we'll auto-
              classify each photo so the right staging options light up.
            </p>
          </div>
          <button
            onClick={startSession}
            disabled={creating}
            className="px-5 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                New session
              </>
            )}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          How it works
        </h2>
        <div className="grid md:grid-cols-4 gap-3">
          {[
            {
              icon: Plus,
              title: "Start a session",
              copy: "One click. No address needed.",
            },
            {
              icon: Home,
              title: "Upload empty rooms",
              copy: "Drag them in. We classify each one.",
            },
            {
              icon: Sparkles,
              title: "Preview six styles",
              copy: "Modern, Traditional, Scandi, Farmhouse, Mid-Century, Coastal. All free.",
            },
            {
              icon: ArrowRight,
              title: "Keep for $3 each",
              copy: "Download the styled render and ship it.",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="panel p-4 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
                <s.icon className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="text-sm font-medium mb-1">{s.title}</div>
              <div className="text-[12px] text-muted-foreground leading-relaxed">
                {s.copy}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Styles preview */}
      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Six styles to choose from
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {STAGING_STYLES.map((s) => (
            <div
              key={s.id}
              className="panel p-4 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <div className="text-sm font-semibold mb-1">{s.label}</div>
              <div className="text-[12px] text-muted-foreground leading-relaxed">
                {s.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Recent sessions
          </h2>
        </div>
        {sessions === null ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="panel p-6 rounded-xl border border-dashed border-white/10 text-center text-sm text-muted-foreground">
            No sessions yet. Start your first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/properties/${s.id}`}
                className="panel p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{s.address}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                    <span>{s.photoCount} photos</span>
                    {s.photosRemaining > 0 && (
                      <span className="text-amber-300">
                        {s.photosRemaining} processing
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
