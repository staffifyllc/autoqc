"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X as XIcon, Sparkles, ArrowRight } from "lucide-react";

// localStorage key for dismissal. Bump the suffix (e.g. -staffify-v2)
// to force every visitor to see the bar again after we change copy.
const DISMISS_KEY = "autoqc_banner_staffify_v1";

// Routes where the bar should NOT appear. Dashboard / app routes are
// for customers who are already inside the product; the bar is for
// public-facing marketing surfaces (landing, pricing, demo, etc).
const HIDE_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/login",
  "/api",
];

const STAFFIFY_URL =
  "https://www.gostaffify.com/?utm_source=autoqc&utm_medium=banner&utm_campaign=partner_discount";

export function AnnouncementBar() {
  const pathname = usePathname() || "/";
  const [dismissed, setDismissed] = useState(true); // start hidden, opt-in on mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const hide =
    !mounted ||
    dismissed ||
    HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (hide) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage blocked - dismissal just won't persist across reloads
    }
  };

  return (
    <div className="relative w-full bg-gradient-to-r from-brand-600/90 via-brand-500/90 to-brand-600/90 border-b border-brand-400/40 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-center gap-3 text-[13px] font-medium">
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
        <p className="text-center leading-tight">
          <span className="font-semibold">Staffify clients get 50% off AutoQC.</span>{" "}
          <Link
            href={STAFFIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 decoration-white/60 hover:decoration-white inline-flex items-center gap-1"
          >
            Explore Staffify
            <ArrowRight className="w-3 h-3" strokeWidth={2.25} />
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute top-1/2 right-2 sm:right-3 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/15 transition-colors"
      >
        <XIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
