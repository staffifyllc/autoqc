"use client";

import { useState, useRef } from "react";
import {
  Bug,
  X,
  Loader2,
  Check,
  Upload as UploadIcon,
  AlertTriangle,
  Lightbulb,
  MessageSquarePlus,
} from "lucide-react";

type FeedbackType = "BUG" | "FEATURE_REQUEST";

// Floating "Send feedback" button + modal, visible on every dashboard
// page. Toggles between bug report and feature request. Submits to
// /api/bugs. Screenshot is optional and uploaded directly to S3 via a
// presigned URL.
export function BugReportWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"MINOR" | "NORMAL" | "CRITICAL">("NORMAL");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setType("BUG");
    setTitle("");
    setDescription("");
    setSeverity("NORMAL");
    setScreenshot(null);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    if (screenshot && screenshot.size > 5 * 1024 * 1024) {
      setError("Screenshot is too large. 5 MB max.");
      return;
    }

    setSubmitting(true);
    try {
      let screenshotKey: string | null = null;

      if (screenshot) {
        const urlRes = await fetch("/api/bugs/screenshot-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: screenshot.name,
            contentType: screenshot.type || "image/png",
          }),
        });
        if (!urlRes.ok) throw new Error("Could not get upload URL");
        const { uploadUrl, key } = await urlRes.json();

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": screenshot.type || "image/png" },
          body: screenshot,
        });
        if (!putRes.ok) throw new Error("Screenshot upload failed");
        screenshotKey = key;
      }

      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          severity: type === "BUG" ? severity : "NORMAL",
          screenshotKey,
          pageUrl:
            typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Submit failed");

      setSuccess(true);
      setTimeout(close, 2200);
    } catch (err: any) {
      setError(err.message ?? "Something broke. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isBug = type === "BUG";

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 group flex items-center gap-2 px-4 py-2.5 rounded-full bg-[hsl(var(--surface-3))] border border-white/10 shadow-lg shadow-black/30 hover:bg-[hsl(var(--surface-2))] transition-colors"
        title="Send feedback"
      >
        <MessageSquarePlus className="w-4 h-4 text-[hsl(var(--primary))]" />
        <span className="text-xs font-medium">Send feedback</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md bg-[hsl(var(--surface-1))] border border-white/10 rounded-2xl shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-[hsl(var(--primary))]" />
                <h2 className="font-semibold">Send feedback</h2>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {success ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-green-300" />
                </div>
                <p className="font-medium">
                  {isBug
                    ? "Thanks. We'll look at this fast."
                    : "Got it. Thanks for the idea."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isBug
                    ? "You'll get an email when it's fixed. Usually under an hour for obvious bugs."
                    : "You'll get an email if we build it. Every feature in AutoQC started as one of these."}
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="p-6 space-y-4">
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("BUG")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${
                      type === "BUG"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    Report a bug
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("FEATURE_REQUEST")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${
                      type === "FEATURE_REQUEST"
                        ? "bg-[hsl(var(--primary))]/15 border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Suggest a feature
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    {isBug ? "Title" : "The feature, in one line"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      isBug
                        ? "Short summary, like 'Download button does nothing'"
                        : "e.g. 'Bulk twilight all exteriors in a property'"
                    }
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={180}
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    {isBug ? "What happened" : "Why it would help"}
                  </label>
                  <textarea
                    placeholder={
                      isBug
                        ? "What you tried, what you expected, what happened instead."
                        : "What would it do, who would use it, and what is the current painful workaround?"
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    required
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                  />
                </div>

                {isBug && (
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                      Severity
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["MINOR", "NORMAL", "CRITICAL"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSeverity(s)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                            severity === s
                              ? s === "CRITICAL"
                                ? "bg-red-500/20 border-red-500/40 text-red-200"
                                : s === "NORMAL"
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                                : "bg-white/10 border-white/20 text-foreground"
                              : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                          }`}
                        >
                          {s === "MINOR" && "Minor"}
                          {s === "NORMAL" && "Normal"}
                          {s === "CRITICAL" && "Blocking"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    {isBug
                      ? "Screenshot (optional, 5 MB max)"
                      : "Mockup or reference (optional, 5 MB max)"}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      setScreenshot(e.target.files?.[0] ?? null)
                    }
                    className="hidden"
                    id="bug-screenshot"
                  />
                  <label
                    htmlFor="bug-screenshot"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm cursor-pointer hover:bg-white/10 transition"
                  >
                    <UploadIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {screenshot ? screenshot.name : "Attach image"}
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="w-full py-2.5 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : isBug ? (
                    "Send bug report"
                  ) : (
                    "Send feature request"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
