"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  GripVertical,
  Loader2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Short delay so a casual click on the row does not trigger a drag.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    setEnabled(next);
    await save({ autoSortEnabled: next });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next); // optimistic
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
            enabled ? "bg-brand-500" : "bg-white/10 border border-white/10"
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

      <section className="panel rounded-xl border border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Room order</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Drag rows to reorder. Saves automatically.
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ol className={`divide-y divide-white/5 ${!enabled ? "opacity-60" : ""}`}>
              {order.map((rt, i) => (
                <SortableRow key={rt} id={rt} index={i} disabled={saving} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </section>

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

function SortableRow({
  id,
  index,
  disabled,
}: {
  id: string;
  index: number;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`px-5 py-3 flex items-center gap-3 bg-[hsl(var(--surface-1))] ${
        isDragging ? "shadow-lg shadow-black/50 ring-1 ring-brand-500/40" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Drag to reorder ${ROOM_TYPE_LABELS[id] ?? id}`}
        className={`shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground transition ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-8 text-xs font-mono text-muted-foreground tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="flex-1 text-sm select-none">
        {ROOM_TYPE_LABELS[id] ?? id}
      </div>
    </li>
  );
}
