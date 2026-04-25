"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sofa,
  Plus,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Clock,
  Sparkles,
  Home,
} from "lucide-react";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { StagingButton } from "@/components/dashboard/StagingButton";
import {
  STAGING_STYLES,
  ELIGIBLE_STAGING_ROOM_TYPES,
} from "@/lib/staging";

type StagingSession = {
  id: string;
  address: string;
  createdAt: string;
  photoCount: number;
};

type Photo = {
  id: string;
  fileName: string;
  status: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  issues: any;
};

const ROOM_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "living_room", label: "Living room" },
  { id: "bedroom", label: "Bedroom" },
  { id: "dining_room", label: "Dining room" },
  { id: "office", label: "Office" },
];

function StagingPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  if (sessionId) {
    return <ActiveSession sessionId={sessionId} onExit={() => router.push("/dashboard/staging")} />;
  }
  return <SessionsLanding router={router} />;
}

export default function VirtualStagingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <StagingPageInner />
    </Suspense>
  );
}

function SessionsLanding({ router }: { router: ReturnType<typeof useRouter> }) {
  const [sessions, setSessions] = useState<StagingSession[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/staging/session")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]));
  }, []);

  const startSession = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/staging/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.property?.id) {
        throw new Error(data.error ?? "Could not start");
      }
      router.push(`/dashboard/staging?session=${data.property.id}`);
    } catch {
      setCreating(false);
      alert("Could not start a staging session. Try again.");
    }
  };

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Sofa className="w-4 h-4 text-amber-300" />
          </div>
          <h1 className="text-2xl font-bold">Virtual Staging</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Drop empty rooms, pick a style, and get photorealistic staged
          renders in seconds. Architecture preserved exactly. Preview is
          free. Keep renders you love for $2 each.
        </p>
      </div>

      <div className="panel p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-transparent">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold mb-1">Start a new session</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Drop your empty rooms in, pick a style for each, and keep the
              renders you love. No address required.
            </p>
          </div>
          <button
            onClick={startSession}
            disabled={creating}
            className="px-5 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                New session
              </>
            )}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          How it works
        </h2>
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { icon: Plus, title: "Start a session", copy: "One click. No address needed." },
            { icon: Home, title: "Upload empty rooms", copy: "Drag them in. Pick the room type." },
            { icon: Sparkles, title: "Preview six styles", copy: "Modern, Traditional, Scandi, Farmhouse, Mid-Century, Coastal." },
            { icon: ArrowRight, title: "Keep for $2 each", copy: "Download the styled render and ship it." },
          ].map((s, i) => (
            <div key={i} className="panel p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3">
                <s.icon className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="text-sm font-medium mb-1">{s.title}</div>
              <div className="text-[12px] text-muted-foreground leading-relaxed">{s.copy}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Six styles to choose from
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {STAGING_STYLES.map((s) => (
            <div key={s.id} className="panel p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="text-sm font-semibold mb-1">{s.label}</div>
              <div className="text-[12px] text-muted-foreground leading-relaxed">{s.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Recent sessions
        </h2>
        {sessions === null ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="panel p-6 rounded-xl border border-dashed border-white/10 text-center text-sm text-muted-foreground">
            No sessions yet. Start your first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/staging?session=${s.id}`}
                className="panel p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{s.address}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                    <span>{s.photoCount} photos</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveSession({ sessionId, onExit }: { sessionId: string; onExit: () => void }) {
  const [property, setProperty] = useState<{ id: string; address: string } | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [roomTypes, setRoomTypes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const r = await fetch(`/api/properties/${sessionId}`);
      if (!r.ok) return;
      const d = await r.json();
      setProperty({ id: d.property.id, address: d.property.address });
      const ph = (d.property.photos ?? []) as Photo[];
      setPhotos(ph);
      // Seed roomTypes from QC classification when present, default to
      // living_room otherwise. Preserve any user picks already in state.
      setRoomTypes((prev) => {
        const next = { ...prev };
        for (const p of ph) {
          if (next[p.id]) continue;
          const classified = (p.issues as any)?._room_type as string | undefined;
          next[p.id] =
            classified && ELIGIBLE_STAGING_ROOM_TYPES.has(classified)
              ? classified
              : "living_room";
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // Light polling so freshly-uploaded photos and just-staged variants
    // appear without a manual refresh. 5s while the page is open.
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [sessionId]);

  if (loading || !property) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading session...
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <button
        onClick={onExit}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All sessions
      </button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sofa className="w-5 h-5 text-amber-300" />
          <h1 className="text-xl font-bold">{property.address}</h1>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {photos.length} photo{photos.length === 1 ? "" : "s"} in this session.
          Drop more below, or click any photo to stage it.
        </p>
      </div>

      <PhotoUploader
        propertyId={property.id}
        propertyAddress={property.address}
        onComplete={reload}
      />

      {photos.length > 0 && (
        <div>
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Your rooms
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {photos.map((p) => {
              const url = p.originalUrl ?? p.thumbnailUrl ?? "";
              const rt = roomTypes[p.id] ?? "living_room";
              return (
                <div
                  key={p.id}
                  className="panel p-3 rounded-xl border border-white/5 bg-white/[0.02] space-y-2"
                >
                  {url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt={p.fileName}
                      className="w-full aspect-[4/3] object-cover rounded-lg bg-black"
                    />
                  )}
                  <div className="text-[12px] font-medium truncate">{p.fileName}</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={rt}
                      onChange={(e) =>
                        setRoomTypes((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500/40 flex-1"
                    >
                      {ROOM_TYPE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <StagingButton
                      photoId={p.id}
                      fileName={p.fileName}
                      roomType={rt}
                      onPurchased={reload}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
