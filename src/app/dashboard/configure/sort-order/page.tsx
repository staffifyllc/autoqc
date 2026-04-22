"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  ChevronUp,
  ChevronDown,
  Loader2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  DEFAULT_PHOTO_SORT_ORDER,
  ROOM_TYPE_LABELS,
} from "@/lib/photoSort";

export default function SortOrderPage() {
  const [enabled, setEnabled] = useState(false);
  const [order, setOrder] = useState<string[]>(DEFAULT_PHOTO_SORT_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agency/sort-order")
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.autoSortEnabled);
        setOrder(d.photoSortOrder ?? DEFAULT_PHOTO_SORT_ORDER);
      })
      .catch(() => setError("Failed to load sort config"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (partial: {
    autoSortEnabled?: boolean;
    photoSortOrder?: string[];
  }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agency/sort-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      setEnabled(data.autoSortEnabled);
      setOrder(data.photoSortOrder);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    await save({ autoSortEnabled: next });
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setOrder(next);
    save({ photoSortOrder: next });
  };

  const resetDefaults = () => {
    setOrder(DEFAULT_PHOTO_SORT_ORDER);
    save({ photoSortOrder: DEFAULT_PHOTO_SORT_ORDER });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5 text-brand-400" />
          Photo order
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          When auto-sort is on, AutoQC groups your property photos by room type
          in the order below. The order applies to the review grid, bulk
          downloads, and platform pushes (Aryeo, HDPhotoHub, Tonomo, etc.).
        </p>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Enable toggle */}
      <section className="panel rounded-xl p-5 border border-white/10 flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Auto-sort photos</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {enabled
              ? "Photos are being sorted by room type."
              : "Photos show in upload order (no sorting)."}
          </div>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={saving}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
            enabled
              ? "bg-brand-500"
              : "bg-white/10 border border-white/10"
          }`}
          aria-pressed={enabled}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </section>

      {/* Order list */}
      <section className="panel rounded-xl border border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Room order</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Use the arrows to reorder. Saves automatically.
            </div>
          </div>
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5"
            title="Restore the default MLS-friendly order"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to default
          </button>
        </div>

        <ol className="divide-y divide-white/5">
          {order.map((rt, i) => (
            <li
              key={rt}
              className={`px-5 py-3 flex items-center gap-3 ${
                !enabled ? "opacity-60" : ""
              }`}
            >
              <div className="w-8 text-xs font-mono text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 text-sm">
                {ROOM_TYPE_LABELS[rt] ?? rt}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveItem(i, -1)}
                  disabled={i === 0 || saving}
                  className="p-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveItem(i, 1)}
                  disabled={i === order.length - 1 || saving}
                  className="p-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Save indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground h-6">
        {saving ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </>
        ) : savedAt ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-green-300" />
            Saved
          </>
        ) : null}
      </div>
    </div>
  );
}
