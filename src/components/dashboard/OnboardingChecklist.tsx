"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Brain,
  Upload,
  FolderSync,
  Sofa,
  Users,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type Status = {
  stylePhotosUploaded: boolean;
  stylePhotosCount: number;
  profileLearned: boolean;
  firstProperty: boolean;
  dropboxConnected: boolean;
  stagingTried: boolean;
  teamInvited: boolean;
};

type Step = {
  key: keyof Status | "stylePhotosUploaded";
  label: string;
  done: boolean;
  href: string;
  cta: string;
  hint: string;
  icon: any;
  required: boolean;
};

const DISMISSED_KEY = "autoqc_onboarding_dismissed";

export function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") {
        setDismissed(true);
      }
    } catch {}
    fetch("/api/onboarding/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  if (dismissed || !status) return null;

  const steps: Step[] = [
    {
      key: "stylePhotosUploaded",
      label: "Upload your preferred style",
      hint:
        "Drop in 3+ photos that look like the work you ship. We'll learn YOUR color, exposure, sharpness, and verticals tolerance from them.",
      done: status.stylePhotosUploaded,
      href: "/dashboard/profiles",
      cta: status.stylePhotosCount > 0
        ? `Continue (${status.stylePhotosCount} so far)`
        : "Upload style references",
      icon: Sparkles,
      required: true,
    },
    {
      key: "profileLearned",
      label: "Run analyze and learn",
      hint:
        "We process your reference photos and write your tolerances back to the Style Profile. Every QC after this is calibrated to your taste.",
      done: status.profileLearned,
      href: "/dashboard/profiles",
      cta: "Open Style Profiles",
      icon: Brain,
      required: true,
    },
    {
      key: "firstProperty",
      label: "Upload your first property",
      hint:
        "Now QC runs against your style. Drop in a real listing's photos and see the results.",
      done: status.firstProperty,
      href: "/dashboard/properties?new=true",
      cta: "Create property",
      icon: Upload,
      required: true,
    },
    {
      key: "dropboxConnected",
      label: "Optional · Connect AutoHDR + Dropbox",
      hint:
        "If you use AutoHDR, point AutoQC at your Dropbox once. Every batch QCs itself automatically and overwrites the originals in place.",
      done: status.dropboxConnected,
      href: "/dashboard/dropbox-automation",
      cta: "Connect Dropbox",
      icon: FolderSync,
      required: false,
    },
    {
      key: "stagingTried",
      label: "Optional · Try Virtual Staging",
      hint:
        "Got an empty room? Stage it in six styles. Previews are free, $2 to keep.",
      done: status.stagingTried,
      href: "/dashboard/staging",
      cta: "Open Virtual Staging",
      icon: Sofa,
      required: false,
    },
    {
      key: "teamInvited",
      label: "Optional · Invite a teammate",
      hint:
        "Bring on a VA or editor with their own login. Each person gets their own access.",
      done: status.teamInvited,
      href: "/dashboard/team",
      cta: "Invite teammate",
      icon: Users,
      required: false,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const requiredDone = steps.filter((s) => s.required).every((s) => s.done);
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);
  const nextStep = steps.find((s) => !s.done) ?? steps[0];

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
  };

  return (
    <div className="panel mb-8 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-transparent overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold">
              {requiredDone
                ? "You're set up — these are bonus."
                : "Start here · get set up in 5 minutes"}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {completed} of {total} done · {pct}%
            </div>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition px-2 py-1 rounded flex items-center gap-1"
        >
          {collapsed ? (
            <>
              <ChevronDown className="w-3 h-3" /> Show
            </>
          ) : (
            <>
              <ChevronUp className="w-3 h-3" /> Hide
            </>
          )}
        </button>
        {requiredDone && (
          <button
            onClick={dismiss}
            className="text-[11px] text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            title="I'm all set — hide this"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-2">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key as string}
                className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                  s.done
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {s.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon
                      className={`w-3.5 h-3.5 ${s.done ? "text-emerald-300" : "text-amber-300"}`}
                    />
                    <span
                      className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {s.hint}
                  </p>
                </div>
                {!s.done && (
                  <Link
                    href={s.href}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition whitespace-nowrap"
                  >
                    {s.cta}
                  </Link>
                )}
              </div>
            );
          })}
          {!requiredDone && (
            <p className="text-[11px] text-muted-foreground mt-2 px-1">
              QC works without setup, but it uses generic defaults.
              Finishing the first three steps calibrates it to your style.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
