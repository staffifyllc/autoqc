// Photo auto-sort helper. Used by property detail, download, and push
// routes. When an agency has autoSortEnabled=true, photos render in the
// configured room-type sequence. Unknown/unclassified fall to the end
// in upload order.

export const DEFAULT_PHOTO_SORT_ORDER = [
  "exterior_front",
  "exterior_back",
  "exterior_pool",
  "living_room",
  "dining_room",
  "kitchen",
  "bedroom",
  "bathroom",
  "office",
  "hallway",
  "basement",
  "other",
];

// Human-readable labels keyed by the enum-ish slug composition.py emits.
export const ROOM_TYPE_LABELS: Record<string, string> = {
  exterior_front: "Exterior, front",
  exterior_back: "Exterior, back",
  exterior_pool: "Exterior, pool / amenity",
  living_room: "Living room",
  dining_room: "Dining room",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  office: "Office",
  hallway: "Hallway",
  basement: "Basement",
  other: "Other",
};

// Valid room types. Anything outside this set is silently ignored in
// sort configs so a bad admin edit cannot break the sort.
export const VALID_ROOM_TYPES = new Set(Object.keys(ROOM_TYPE_LABELS));

export function sanitizePhotoSortOrder(input: unknown): string[] {
  if (!Array.isArray(input)) return DEFAULT_PHOTO_SORT_ORDER;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    if (typeof v === "string" && VALID_ROOM_TYPES.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  // Ensure every valid type appears exactly once so reordering does not
  // drop photos from the output. Missing ones get appended in the
  // default sequence.
  for (const v of DEFAULT_PHOTO_SORT_ORDER) {
    if (!seen.has(v)) out.push(v);
  }
  return out;
}

type SortablePhoto = {
  issues: unknown;
  createdAt: Date | string;
};

function roomTypeOf(photo: SortablePhoto): string | null {
  if (photo.issues && typeof photo.issues === "object") {
    const rt = (photo.issues as any)._room_type;
    if (typeof rt === "string") return rt;
  }
  return null;
}

// Stable sort that groups by room type in the order specified, then
// keeps upload order within a group. Does NOT mutate the input.
export function sortPhotosByRoomType<T extends SortablePhoto>(
  photos: T[],
  order: string[]
): T[] {
  const position = new Map<string, number>();
  order.forEach((rt, i) => position.set(rt, i));
  const unknownRank = order.length;

  return [...photos]
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => {
      const ra = roomTypeOf(a.p);
      const rb = roomTypeOf(b.p);
      const pa = ra && position.has(ra) ? position.get(ra)! : unknownRank;
      const pb = rb && position.has(rb) ? position.get(rb)! : unknownRank;
      if (pa !== pb) return pa - pb;
      // Stable tiebreak by createdAt ascending (upload order).
      const ta =
        typeof a.p.createdAt === "string"
          ? new Date(a.p.createdAt).getTime()
          : a.p.createdAt.getTime();
      const tb =
        typeof b.p.createdAt === "string"
          ? new Date(b.p.createdAt).getTime()
          : b.p.createdAt.getTime();
      if (ta !== tb) return ta - tb;
      return a.idx - b.idx;
    })
    .map((x) => x.p);
}
