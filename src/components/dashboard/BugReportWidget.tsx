"use client";

import { useState, useRef } from "react";
import { Bug, X, Loader2, Check, Upload as UploadIcon, AlertTriangle } from "lucide-react";

// Floating "Report a bug" button + modal, visible on every dashboard
// page. Submits to /api/bugs. Screenshot is optional and uploaded
// directly to S3 via a presigned URL.
export function BugReportWidget() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"MINOR" | "NORMAL" | "CRITICAL">("NORMAL");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
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
    // give the exit animation a moment before clearing form
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
          title: title.trim(),
          description: description.trim(),
          severity,
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

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 px-4 py-2.5 rounded-full bg-[hsl(var(--surface-3))] border border-white/10 shadow-lg shadow-black/30 hover:bg-[hsl(var(--surface-2))] transition-colors"
        title="Report a bug"
      >
        <Bug className="w-4 h-4 text-amber-300" />
        <span className="text-xs font-medium">Report a bug</span>
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
                <Bug className="w-4 h-4 text-amber-300" />
                <h2 className="font-semibold">Report a bug</h2>
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
                <p className="font-medium">Thanks. We'll look at this fast.</p>
                <p className="text-xs text-muted-foreground">
                  You'll get an email when it's fixed. Usually under an hour for
                  obvious bugs.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Short summary, like 'Download button does nothing'"
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
                    What happened
                  </label>
                  <textarea
                    placeholder="What you tried, what you expected, what happened instead."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    required
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                  />
                </div>

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

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Screenshot (optional, 5 MB max)
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
                      {screenshot ? screenshot.name : "Attach screenshot"}
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
                  ) : (
                    "Send bug report"
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
