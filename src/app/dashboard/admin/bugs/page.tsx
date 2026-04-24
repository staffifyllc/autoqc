"use client";

import { useEffect, useState } from "react";
import {
  Bug,
  Lightbulb,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  AlertTriangle,
  MessageSquarePlus,
  ThumbsUp,
} from "lucide-react";

type Reporter = { id: string; name: string | null; email: string } | null;
type FeedbackType = "BUG" | "FEATURE_REQUEST";

type BugReport = {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  severity: "MINOR" | "NORMAL" | "CRITICAL";
  status: "NEW" | "TRIAGED" | "IN_PROGRESS" | "FIXED" | "WONT_FIX";
  screenshotKey: string | null;
  pageUrl: string | null;
  prUrl: string | null;
  internalNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: Reporter;
};

type Filter = "ALL" | FeedbackType;

const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "FIXED", "WONT_FIX"] as const;

const SEVERITY_COLOR: Record<BugReport["severity"], string> = {
  CRITICAL: "bg-red-500/20 border-red-500/40 text-red-200",
  NORMAL: "bg-amber-500/10 border-amber-500/30 text-amber-200",
  MINOR: "bg-white/5 border-white/10 text-muted-foreground",
};

const STATUS_COLOR: Record<BugReport["status"], string> = {
  NEW: "bg-red-500/20 border-red-500/40 text-red-200",
  TRIAGED: "bg-amber-500/10 border-amber-500/30 text-amber-200",
  IN_PROGRESS: "bg-blue-500/10 border-blue-500/30 text-blue-200",
  FIXED: "bg-green-500/10 border-green-500/30 text-green-200",
  WONT_FIX: "bg-white/5 border-white/10 text-muted-foreground",
};

export default function AdminBugsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  const load = async () => {
    try {
      const res = await fetch("/api/bugs?scope=all");
      if (res.status === 403) throw new Error("Admin access required");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBugs(data.bugs ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredBugs =
    filter === "ALL" ? bugs : bugs.filter((b) => b.type === filter);
  const bugCount = bugs.filter((b) => b.type === "BUG").length;
  const featureCount = bugs.filter((b) => b.type === "FEATURE_REQUEST").length;

  const update = async (id: string, patch: Partial<BugReport>) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading reports...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 text-sm text-red-300 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  }

  const newCount = filteredBugs.filter((b) => b.status === "NEW").length;
  const openCount = filteredBugs.filter(
    (b) => !["FIXED", "WONT_FIX"].includes(b.status)
  ).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-[hsl(var(--primary))]" />
            Feedback
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {newCount} new &middot; {openCount} open &middot; {filteredBugs.length} shown
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          Refresh
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {([
          { key: "ALL", label: "All", count: bugs.length, icon: null },
          { key: "BUG", label: "Bugs", count: bugCount, icon: Bug },
          {
            key: "FEATURE_REQUEST",
            label: "Feature requests",
            count: featureCount,
            icon: Lightbulb,
          },
        ] as const).map((p) => {
          const active = filter === p.key;
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              onClick={() => setFilter(p.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                active
                  ? "bg-[hsl(var(--primary))]/15 border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {p.label}
              <span className="opacity-60">{p.count}</span>
            </button>
          );
        })}
      </div>

      {filteredBugs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-muted-foreground text-sm">
          {bugs.length === 0
            ? "No feedback yet. When a user submits a bug report or feature request, it shows up here."
            : "No items in this view."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBugs.map((bug) => {
            const isExpanded = expanded === bug.id;
            const age = new Date(bug.createdAt).toLocaleString();
            return (
              <div
                key={bug.id}
                className="border border-white/10 rounded-xl bg-[hsl(var(--surface-1))] overflow-hidden"
              >
                <button
                  className="w-full text-left p-4 hover:bg-white/5 transition"
                  onClick={() => setExpanded(isExpanded ? null : bug.id)}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${
                        bug.type === "FEATURE_REQUEST"
                          ? "bg-[hsl(var(--primary))]/15 border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      }`}
                    >
                      {bug.type === "FEATURE_REQUEST" ? (
                        <>
                          <Lightbulb className="w-3 h-3" /> Feature
                        </>
                      ) : (
                        <>
                          <Bug className="w-3 h-3" /> Bug
                        </>
                      )}
                    </div>
                    {bug.type === "BUG" && (
                      <div
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${SEVERITY_COLOR[bug.severity]}`}
                      >
                        {bug.severity}
                      </div>
                    )}
                    <div
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${STATUS_COLOR[bug.status]}`}
                    >
                      {bug.status.replace("_", " ")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{bug.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          {bug.reporter?.name ?? bug.reporter?.email ?? "unknown"}
                        </span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {age}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-white/10 space-y-4 bg-black/20">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Description
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {bug.description}
                      </p>
                    </div>

                    {bug.pageUrl && (
                      <div className="text-xs text-muted-foreground">
                        Reported from:{" "}
                        <a
                          href={bug.pageUrl}
                          className="text-blue-300 hover:underline break-all"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {bug.pageUrl}
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                          Status
                        </label>
                        <select
                          value={bug.status}
                          onChange={(e) =>
                            update(bug.id, { status: e.target.value as any })
                          }
                          disabled={saving === bug.id}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                          Fix PR URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://github.com/staffifyllc/autoqc/pull/..."
                          defaultValue={bug.prUrl ?? ""}
                          onBlur={(e) => {
                            if (e.target.value !== (bug.prUrl ?? "")) {
                              update(bug.id, { prUrl: e.target.value } as any);
                            }
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                        Internal notes
                      </label>
                      <textarea
                        placeholder="Internal notes - not shown to the reporter."
                        defaultValue={bug.internalNotes ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (bug.internalNotes ?? "")) {
                            update(bug.id, { internalNotes: e.target.value } as any);
                          }
                        }}
                        rows={3}
                        className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {bug.prUrl && (
                        <a
                          href={bug.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Review PR on GitHub
                        </a>
                      )}
                      {bug.type === "FEATURE_REQUEST" &&
                        bug.status !== "TRIAGED" &&
                        bug.status !== "FIXED" &&
                        bug.status !== "WONT_FIX" && (
                          <button
                            onClick={() =>
                              update(bug.id, { status: "TRIAGED" } as any)
                            }
                            disabled={saving === bug.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            Approve (notify reporter)
                          </button>
                        )}
                      {bug.status !== "FIXED" && (
                        <button
                          onClick={() => update(bug.id, { status: "FIXED" } as any)}
                          disabled={saving === bug.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-green-200 hover:bg-green-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {bug.type === "FEATURE_REQUEST"
                            ? "Mark shipped (notify reporter)"
                            : "Mark fixed (notify reporter)"}
                        </button>
                      )}
                      {bug.status !== "WONT_FIX" && bug.status !== "FIXED" && (
                        <button
                          onClick={() =>
                            update(bug.id, { status: "WONT_FIX" } as any)
                          }
                          disabled={saving === bug.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" />
                          {bug.type === "FEATURE_REQUEST"
                            ? "Deny (notify reporter)"
                            : "Won't fix"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
