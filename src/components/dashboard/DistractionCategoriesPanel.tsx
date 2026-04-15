"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import {
  DISTRACTION_CATEGORIES,
  RISKY_TOOLTIP,
} from "@/lib/distractionCategories";

/**
 * Checkbox panel for choosing which distraction categories the
 * Premium AI removal step should act on. Groups into Standard (safe)
 * and Use with care (risky). Design: hairline borders, mono labels,
 * electric-green accent to match the rest of the dashboard.
 */
export function DistractionCategoriesPanel({
  value,
  onChange,
  disabled = false,
  premiumOnly = false,
  compact = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** When true, shows a banner reminding that the check only runs on Premium. */
  premiumOnly?: boolean;
  compact?: boolean;
}) {
  const safe = useMemo(
    () => DISTRACTION_CATEGORIES.filter((c) => !c.risky),
    []
  );
  const risky = useMemo(
    () => DISTRACTION_CATEGORIES.filter((c) => c.risky),
    []
  );

  const set = new Set(value);
  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const enableAll = (risky: boolean) => {
    if (disabled) return;
    const next = new Set(set);
    DISTRACTION_CATEGORIES.filter((c) => c.risky === risky).forEach((c) =>
      next.add(c.id)
    );
    onChange(Array.from(next));
  };

  const clearAll = (risky: boolean) => {
    if (disabled) return;
    const next = new Set(set);
    DISTRACTION_CATEGORIES.filter((c) => c.risky === risky).forEach((c) =>
      next.delete(c.id)
    );
    onChange(Array.from(next));
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {premiumOnly && (
        <p className="text-[11px] text-muted-foreground font-mono">
          Distraction removal runs on Premium properties only. Toggling
          categories here stores the preference so an upgrade picks it up.
        </p>
      )}

      <Group
        title="Standard (safe)"
        subtitle="Transient clutter. Safe to remove."
        items={safe}
        value={set}
        toggle={toggle}
        onEnableAll={() => enableAll(false)}
        onClearAll={() => clearAll(false)}
        disabled={disabled}
      />

      <Group
        title="Use with care"
        subtitle={RISKY_TOOLTIP}
        items={risky}
        value={set}
        toggle={toggle}
        onEnableAll={() => enableAll(true)}
        onClearAll={() => clearAll(true)}
        disabled={disabled}
        risky
      />
    </div>
  );
}

function Group({
  title,
  subtitle,
  items,
  value,
  toggle,
  onEnableAll,
  onClearAll,
  disabled,
  risky = false,
}: {
  title: string;
  subtitle: string;
  items: typeof DISTRACTION_CATEGORIES;
  value: Set<string>;
  toggle: (id: string) => void;
  onEnableAll: () => void;
  onClearAll: () => void;
  disabled: boolean;
  risky?: boolean;
}) {
  return (
    <div className="panel hairline-top p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p
            className={`text-[11px] mt-0.5 flex items-center gap-1 ${
              risky ? "text-amber-300/80" : "text-muted-foreground"
            }`}
            title={risky ? RISKY_TOOLTIP : undefined}
          >
            {risky && <Info className="w-3 h-3 shrink-0" />}
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEnableAll}
            disabled={disabled}
            className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50 px-2 py-1 rounded hover:bg-white/5"
          >
            All
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50 px-2 py-1 rounded hover:bg-white/5"
          >
            None
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {items.map((c) => {
          const on = value.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={disabled}
              title={c.description}
              className={`text-left px-2.5 py-1.5 rounded border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                on
                  ? risky
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))] text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-sm border shrink-0 ${
                    on
                      ? risky
                        ? "bg-amber-400 border-amber-400"
                        : "accent-bg border-transparent"
                      : "border-border"
                  }`}
                />
                <span className="text-xs font-medium truncate">{c.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
