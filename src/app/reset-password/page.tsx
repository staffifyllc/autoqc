"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Camera, ArrowRight, Loader2, Lock, CheckCircle2 } from "lucide-react";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This reset link is invalid. Request a new one.");
    }
  }, [token]);

  const canSubmit =
    token.length > 0 &&
    password.length >= 10 &&
    password === confirm &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed. Try again.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Kick off redirect to /login after a brief confirmation.
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Reset failed. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">AutoQC</span>
        </Link>

        {success ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Password updated</h1>
            <p className="text-muted-foreground text-sm">
              Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Choose a new password</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Ten characters or more. After you save it, you'll sign in with the new password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  New password
                </label>
                <input
                  type="password"
                  placeholder="At least 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Confirm password
                </label>
                <input
                  type="password"
                  placeholder="Type it again"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                />
                {confirm.length > 0 && confirm !== password && (
                  <p className="text-xs text-red-300 mt-1.5">
                    Passwords do not match.
                  </p>
                )}
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Save new password
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-6">
              <Link href="/login" className="text-foreground hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
