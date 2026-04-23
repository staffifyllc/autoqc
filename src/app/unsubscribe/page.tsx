"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Check, AlertTriangle, Loader2 } from "lucide-react";

export default function UnsubscribePage() {
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "ok"; email?: string; preview?: boolean }
    | { kind: "err"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus({ kind: "err", message: "Missing unsubscribe token." });
      return;
    }
    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.ok) {
          setStatus({
            kind: "err",
            message: data.error ?? "Could not unsubscribe.",
          });
          return;
        }
        setStatus({
          kind: "ok",
          email: data.email,
          preview: data.preview,
        });
      })
      .catch(() =>
        setStatus({ kind: "err", message: "Network error. Try again." })
      );
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8 text-foreground"
        >
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">AutoQC</span>
        </Link>

        {status.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Updating your
            preferences...
          </div>
        )}

        {status.kind === "ok" && (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-green-300" />
            </div>
            <h1 className="text-xl font-bold">
              {status.preview
                ? "Preview link working"
                : "You are unsubscribed"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {status.preview
                ? "This is a preview token, no change was made."
                : `${status.email ?? "Your account"} will no longer receive product update emails. Transactional messages (bug fixes, billing receipts) still go through so you do not miss anything important.`}
            </p>
            <p className="pt-2">
              <Link
                href="/"
                className="inline-block text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                Back to AutoQC
              </Link>
            </p>
          </div>
        )}

        {status.kind === "err" && (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-300" />
            </div>
            <h1 className="text-xl font-bold">Could not unsubscribe</h1>
            <p className="text-sm text-muted-foreground">{status.message}</p>
            <p className="pt-2">
              <Link
                href="/"
                className="inline-block text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                Back to AutoQC
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
