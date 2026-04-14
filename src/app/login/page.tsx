"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Camera, Mail, ArrowRight, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Check if this user already has an agency (returning user vs new)
      const checkRes = await fetch(
        `/api/auth/check-user?email=${encodeURIComponent(email)}`
      );
      const { hasAgency } = await checkRes.json();

      const res = await signIn("dev-login", {
        email,
        name: email.split("@")[0],
        callbackUrl: hasAgency ? "/dashboard" : "/onboarding",
      });
      if (res?.error) {
        alert("Sign in failed: " + res.error);
        setLoading(false);
      }
    } catch (err) {
      alert("Sign in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
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

          <h1 className="text-2xl font-bold mb-2">Welcome</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Sign in or create an account to continue.
          </p>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Continue
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            New to AutoQC? We&apos;ll walk you through a quick setup after you
            continue.
          </p>
        </motion.div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-brand-950 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="absolute inset-0 mesh-gradient opacity-50" />
        <div className="relative text-center max-w-md p-8">
          <h2 className="text-3xl font-bold mb-4">
            Automated QC for every shoot.
          </h2>
          <p className="text-muted-foreground">
            Stop spending hours reviewing photos manually. Let AI handle
            verticals, color, exposure, and composition so you can focus on
            shooting.
          </p>
        </div>
      </div>
    </div>
  );
}
