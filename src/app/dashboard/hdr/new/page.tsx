"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Layers, ArrowLeft, Loader2 } from "lucide-react";

export default function NewHdrShootPage() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!address.trim()) {
      setError("Add a shoot name or address first");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          hdrMode: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Create failed (${res.status})`);
      }
      const { property } = await res.json();
      // Land on the property detail with the uploader open so the
      // agent can drop brackets immediately.
      router.push(`/dashboard/properties/${property.id}?upload=true`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard/hdr"
        className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.25} />
        Back to shoots
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-primary" strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">New HDR shoot</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Name the shoot. Brackets get uploaded on the next screen.
          </p>
        </div>
      </div>

      <div className="panel hairline-top p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Shoot name or address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="123 Ocean Dr, Miami FL"
            className="w-full px-3 py-2 rounded-md bg-[hsl(var(--surface-1))] border border-border focus:outline-none focus:border-primary/50 text-sm"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground font-mono">
            Used as the label across the dashboard and in download zip names.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !address.trim()}
          className="w-full py-2.5 rounded-md accent-bg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 glow-sm"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitting ? "Creating..." : "Create shoot and start upload"}
        </button>
      </div>

      <div className="mt-5 panel hairline-top p-4 bg-[hsl(var(--surface-1))]">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          How it works
        </p>
        <ol className="space-y-1.5 text-[12px] text-muted-foreground">
          <li>1. Drop all your ARW brackets at once (3, 5, or 7 per scene).</li>
          <li>2. We group them by EXIF capture time into individual scenes.</li>
          <li>
            3. Lambda fuses each scene with Mertens exposure fusion, then
            applies the Flylisted look.
          </li>
          <li>
            4. Review before/after, download finished JPEGs, or push to your
            connected platforms.
          </li>
        </ol>
      </div>
    </div>
  );
}
