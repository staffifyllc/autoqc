"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Camera, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show the success state. The API returns 200 regardless of
      // whether the email exists (to prevent account enumeration).
      setSent(true);
    } catch {
      // Still show success — errors at this step shouldn't leak info.
      setSent(true);
    } finally {
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

        {!sent ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Enter your email and we'll send you a link to choose a new password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || email.length === 0}
                className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Send reset link
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Check your inbox</h1>
            <p className="text-muted-foreground text-sm mb-8">
              If an account exists for <strong>{email}</strong>, we just sent a password reset link. The link is good for 60 minutes.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link href="/login" className="text-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
