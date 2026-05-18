"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Sparkles, X as XIcon } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  name: string;
  email: string | null;
  isStaffifyClient: boolean;
  creditBalance: number;
};

export function StaffifyClientPicker() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load the full agency list on mount. Cheap - same dataset feeding
  // the admin table next door.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/staffify-clients");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { agencies: Row[] };
        if (!cancelled) setRows(json.agencies);
      } catch (err) {
        if (!cancelled) toast.error("Failed to load agencies");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the dropdown when the user clicks outside of it.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const flagged = useMemo(
    () => rows.filter((r) => r.isStaffifyClient),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [query, rows]);

  const toggle = async (row: Row) => {
    const desired = !row.isStaffifyClient;
    setSavingId(row.id);
    // Optimistic flip so the checkbox doesn't lag behind the click.
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, isStaffifyClient: desired } : r,
      ),
    );
    try {
      const res = await fetch("/api/admin/staffify-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: row.id, isStaffify: desired }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(
        desired
          ? `${row.name} marked as Staffify client (50% off active)`
          : `${row.name} unmarked (back to standard pricing)`,
      );
    } catch (err) {
      // Roll back the optimistic update.
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, isStaffifyClient: !desired } : r,
        ),
      );
      toast.error("Update failed, try again");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between mb-3 gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            STAFFIFY PARTNER FLAG
          </p>
          <h2 className="text-sm font-medium">
            Mark agencies as Staffify clients
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Flagged agencies automatically pay $5/credit and $6/property
            (50% off). Toggle as many as you like from the dropdown.
          </p>
        </div>
        <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 whitespace-nowrap">
          {flagged.length} flagged
        </span>
      </div>

      {/* Currently-flagged chips. Click X to unflag inline. */}
      {flagged.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {flagged.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[12px]"
            >
              <Sparkles className="w-3 h-3" strokeWidth={2.25} />
              <span className="max-w-[180px] truncate">{r.name}</span>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={savingId === r.id}
                className="hover:text-white disabled:opacity-50"
                aria-label={`Unflag ${r.name}`}
              >
                <XIcon className="w-3 h-3" strokeWidth={2.25} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[hsl(var(--surface-1))] border border-border hover:border-white/20 text-[13px] transition-colors"
        >
          <span className="text-muted-foreground">
            {loading
              ? "Loading agencies…"
              : `Pick agencies (${rows.length} total)`}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.75}
          />
        </button>

        {open && (
          <div className="absolute z-30 mt-1.5 left-0 right-0 panel border border-border shadow-xl bg-[hsl(var(--surface-2))] rounded-md overflow-hidden">
            {/* Search */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <Search
                className="w-3.5 h-3.5 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by agency name or owner email…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <XIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                  No agencies match.
                </p>
              )}
              {filtered.map((r) => {
                const isSaving = savingId === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => toggle(r)}
                    disabled={isSaving}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[hsl(var(--surface-3))] text-left transition-colors disabled:opacity-50"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        r.isStaffifyClient
                          ? "bg-emerald-500/20 border-emerald-400"
                          : "bg-transparent border-white/20"
                      }`}
                    >
                      {r.isStaffifyClient && (
                        <Check
                          className="w-3 h-3 text-emerald-300"
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {r.name}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {r.email || "(no owner email)"}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                      bal {r.creditBalance}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
