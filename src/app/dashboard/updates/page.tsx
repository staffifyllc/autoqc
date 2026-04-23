"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Rocket,
  Shield,
  Wrench,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { updates, UpdateCategory } from "@/lib/updates";

const LAST_SEEN_KEY = "autoqc_updates_last_seen_version";

const CATEGORY_STYLES: Record<
  UpdateCategory,
  { label: string; cls: string; Icon: any }
> = {
  Feature: {
    label: "Feature",
    cls: "bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))]",
    Icon: Sparkles,
  },
  Fix: {
    label: "Fix",
    cls: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    Icon: Wrench,
  },
  Polish: {
    label: "Polish",
    cls: "bg-indigo-500/10 border-indigo-500/30 text-indigo-200",
    Icon: Rocket,
  },
  Security: {
    label: "Security",
    cls: "bg-red-500/10 border-red-500/30 text-red-200",
    Icon: Shield,
  },
};

export default function UpdatesPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const latest = updates[0]?.version;
    if (latest) {
      localStorage.setItem(LAST_SEEN_KEY, latest);
      // Broadcast so the sidebar badge clears without a reload.
      window.dispatchEvent(new Event("autoqc:updates-seen"));
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Rocket className="w-6 h-6 text-[hsl(var(--accent))]" />
          What's new
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Every feature, fix, and polish that ships to AutoQC. Newest first.
          Got a bug or a request? Use the <strong>Report a bug</strong>{" "}
          button in the bottom-right and we will usually have it in the queue
          the same day.
        </p>
      </header>

      <div className="relative space-y-10">
        {/* Timeline rail */}
        <div
          aria-hidden
          className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-[hsl(var(--accent))]/40 via-border to-transparent"
        />

        {updates.map((u) => (
          <article key={u.version} className="relative pl-10">
            {/* Version dot */}
            <div className="absolute left-0 top-1">
              <div className="w-[18px] h-[18px] rounded-full bg-[hsl(var(--accent))] shadow-[0_0_12px_hsl(var(--accent)/0.7)]" />
              <div className="absolute inset-0 rounded-full ring-4 ring-[hsl(var(--accent))]/15 animate-pulse" />
            </div>

            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5">
                v{u.version}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatDate(u.date)}
              </span>
            </div>

            <h2 className="text-xl font-semibold tracking-tight mb-1">
              {u.title}
            </h2>
            {u.tagline && (
              <p className="text-sm text-muted-foreground mb-5">
                {u.tagline}
              </p>
            )}

            <div className="space-y-3">
              {u.changes.map((c, i) => {
                const { cls, Icon, label } = CATEGORY_STYLES[c.category];
                return (
                  <div
                    key={i}
                    className="panel p-4 rounded-xl border border-border hover:border-[hsl(var(--accent))]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${cls}`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </span>
                      <h3 className="text-sm font-medium">{c.title}</h3>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {c.body}
                    </p>
                    {c.href && (
                      <Link
                        href={c.href}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[hsl(var(--accent))] hover:underline"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
