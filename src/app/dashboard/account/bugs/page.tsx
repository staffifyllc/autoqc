"use client";

import { useEffect, useState } from "react";
import { Bug, Loader2, Clock, CheckCircle2 } from "lucide-react";

type BugReport = {
  id: string;
  title: string;
  description: string;
  severity: "MINOR" | "NORMAL" | "CRITICAL";
  status: "NEW" | "TRIAGED" | "IN_PROGRESS" | "FIXED" | "WONT_FIX";
  createdAt: string;
  resolvedAt: string | null;
};

const STATUS_LABEL: Record<BugReport["status"], string> = {
  NEW: "Received",
  TRIAGED: "Acknowledged",
  IN_PROGRESS: "Working on it",
  FIXED: "Fixed and live",
  WONT_FIX: "Declined",
};

const STATUS_COLOR: Record<BugReport["status"], string> = {
  NEW: "bg-amber-500/10 border-amber-500/30 text-amber-200",
  TRIAGED: "bg-amber-500/10 border-amber-500/30 text-amber-200",
  IN_PROGRESS: "bg-blue-500/10 border-blue-500/30 text-blue-200",
  FIXED: "bg-green-500/10 border-green-500/30 text-green-200",
  WONT_FIX: "bg-white/5 border-white/10 text-muted-foreground",
};

export default function MyBugsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bugs?scope=mine")
      .then((r) => r.json())
      .then((d) => setBugs(d.bugs ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="w-5 h-5 text-amber-300" />
          My bug reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reports you have submitted and what we did with them.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : bugs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-muted-foreground text-sm">
          No reports yet. Hit the "Report a bug" button at the bottom-right when
          something looks wrong.
        </div>
      ) : (
        <div className="space-y-3">
          {bugs.map((bug) => (
            <div
              key={bug.id}
              className="panel rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{bug.title}</div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {bug.description}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(bug.createdAt).toLocaleDateString()}
                    </span>
                    {bug.resolvedAt && (
                      <>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1 text-green-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Fixed {new Date(bug.resolvedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0 ${STATUS_COLOR[bug.status]}`}
                >
                  {STATUS_LABEL[bug.status]}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
