// Virtual Staging prompt library. Mirrors the Twilight pattern in
// src/lib/gemini.ts: a single PROMPT constant is too blunt here because
// staging has two axes (room type × furniture style), so we build the
// prompt from a room manifest plus a style modifier at request time.
//
// Model: google/nano-banana on Replicate (same weights as Twilight).
// Per-call cost ~$0.04; retail $3 per purchased render → strong margin.
//
// Ship behavior: staging runs behind the VIRTUAL_STAGING_ENABLED env
// flag. When the flag is off, only admin agencies can preview/purchase.

export const STAGING_CREDIT_COST = 3;

// Room types where staging actually helps sellers. Kitchens rarely need
// staging and bathrooms/hallways almost never do; gating them off keeps
// the feature from disappointing agents on low-value rooms.
export const ELIGIBLE_STAGING_ROOM_TYPES = new Set([
  "living_room",
  "bedroom",
  "dining_room",
  "office",
]);

// Style catalog. id is what we persist + pass in the URL; label is what
// the user sees; description is for the UI tooltip.
export type StagingStyleId =
  | "modern"
  | "traditional"
  | "scandinavian"
  | "farmhouse"
  | "midcentury"
  | "coastal";

type StagingStyle = {
  id: StagingStyleId;
  label: string;
  description: string;
  // Free-form modifier text appended to the system prompt for this style.
  modifier: string;
};

export const STAGING_STYLES: StagingStyle[] = [
  {
    id: "modern",
    label: "Modern",
    description: "Clean lines, neutral palette, matte metals. The default safe pick.",
    modifier:
      "Modern style: clean straight lines, neutral palette of off-white / charcoal / warm grey, matte black or brushed brass accents, low-profile sofas or platform beds, minimal decor, a few abstract prints.",
  },
  {
    id: "traditional",
    label: "Traditional",
    description: "Warm woods, classic sofas, area rugs. Reads broad-appeal for family homes.",
    modifier:
      "Traditional style: warm wood tones, classic rolled-arm sofa or four-poster bed, patterned area rug, table lamps, framed landscape art, layered throw pillows.",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    description: "Light woods, white walls, low-profile. Good for small rooms and northern light.",
    modifier:
      "Scandinavian / minimalist style: light natural woods (oak, ash), white or off-white upholstery, low-profile Nordic furniture, simple geometry, a single statement plant, warm wool throws.",
  },
  {
    id: "farmhouse",
    label: "Modern Farmhouse",
    description: "Shiplap-adjacent textures, matte black, rustic warmth.",
    modifier:
      "Modern farmhouse style: distressed wood, matte black hardware, linen upholstery in oatmeal or ivory, jute rug, wicker accents, galvanized metal, understated rustic warmth.",
  },
  {
    id: "midcentury",
    label: "Mid-Century Modern",
    description: "Walnut, tapered legs, jewel tones. High-style, great for listings priced up.",
    modifier:
      "Mid-century modern style: walnut furniture with tapered legs, olive or burnt orange or teal upholstery, geometric area rug, sputnik or globe pendant (only if a fixture already exists), abstract art from the 1960s palette.",
  },
  {
    id: "coastal",
    label: "Coastal",
    description: "Light blues, linen, rattan. Huge in FL, CA, Gulf markets.",
    modifier:
      "Coastal / transitional style: light blues and sandy neutrals, linen slipcovered sofa, rattan or wicker accent chair, jute rug, driftwood-grey woods, simple marine or botanical art, woven baskets.",
  },
];

export function styleById(id: string): StagingStyle | null {
  return STAGING_STYLES.find((s) => s.id === id) ?? null;
}

// Per-room furniture manifest. Keeps the model grounded: tells it WHAT
// to add and, critically, WHAT NOT to add. Hallucinated architecture
// (an invented fireplace, an extra window, a second bed) is the #1
// failure mode on these models and the negative constraints suppress it.
type RoomManifest = {
  add: string;
  avoid: string;
};

const ROOM_MANIFEST: Record<string, RoomManifest> = {
  living_room: {
    add:
      "A sectional or three-seat sofa against the longest visible wall, two accent chairs angled toward it, a coffee table between them, an area rug that anchors the seating group, a floor lamp in a corner, wall art above the sofa at eye level, one or two large houseplants.",
    avoid:
      "Do not add a fireplace, do not add a TV, do not add a ceiling fan, do not add additional windows or doors, do not add skylights, do not add extra walls.",
  },
  bedroom: {
    add:
      "A single queen or king bed centered on the longest solid wall, two matching nightstands with table lamps, a dresser against an opposite wall, a rug under the foot of the bed, neutral bedding with a throw folded at the foot, minimal wall art above the headboard.",
    avoid:
      "Do not add a second bed, do not add a ceiling fan, do not add a TV or monitor, do not add additional windows or doors, do not add a closet door that is not visible in the original.",
  },
  dining_room: {
    add:
      "A rectangular dining table sized to the room, four to eight matching chairs, a table runner or centerpiece, a pendant light only if a pendant fixture is already visible in the original photo, a sideboard or credenza against a wall if space allows.",
    avoid:
      "Do not add a chandelier or ceiling fixture that is not already in the original photo, do not add windows or doors, do not add a second dining set.",
  },
  office: {
    add:
      "A desk against a visible wall (ideally near a window if one is present), an ergonomic or classic task chair, a bookshelf with a few books and one or two decor objects, a desk lamp, a task-appropriate rug, a single plant.",
    avoid:
      "Do not add additional windows, do not add a second desk, do not add a bed or convertible sofa unless the room was clearly a bedroom, do not add a TV.",
  },
};

// The always-on preservation clause. Paraphrased from the Twilight
// prompt because the same "edit this image, keep the rest" constraint
// matters even more for staging — an invented wall destroys the listing.
const PRESERVATION_CLAUSE = `CRITICAL rules you must not break:
- Preserve the exact architecture, walls, windows, doors, floors, light fixtures, and ceiling of the original photo. Do not move, remove, recolor, or redraw any of these.
- Do not add or remove any structural elements. The room must be the SAME room after staging, only with furniture added.
- Do not alter the crop, framing, aspect ratio, or camera angle.
- Preserve the exact lighting direction. Light coming through a window from the left must still come from the left, and the furniture you add must cast shadows consistent with that direction.
- Do not add reflective glass furniture that would show impossible reflections (mirrored coffee tables, glass dining tables on this pass).
- Furniture must be in realistic proportion to the room. Do not oversize a sofa, do not undersize a bed.
- The result must look like a photo of the SAME room after a stager came in, not a different room.
- No people, no pets, no text overlays, no watermarks.
- Keep the render photorealistic and MLS-appropriate. No heavy color grading, no exaggerated saturation.`;

export function buildStagingPrompt(opts: {
  roomType: string;
  style: StagingStyleId;
}): string {
  const manifest = ROOM_MANIFEST[opts.roomType];
  const style = styleById(opts.style);
  if (!manifest) {
    throw new Error(`No staging manifest for room type: ${opts.roomType}`);
  }
  if (!style) {
    throw new Error(`Unknown staging style: ${opts.style}`);
  }

  return `Stage this empty real estate photo by adding furniture. Keep the room exactly as it is architecturally; only add staging.

Furniture to add:
${manifest.add}

Furniture and elements NOT to add:
${manifest.avoid}

${style.modifier}

${PRESERVATION_CLAUSE}`;
}

// Feature gate helper. When the env flag is off, staging remains visible
// only to admin agencies (Paul, and any admin-flagged test account).
export function stagingEnabledForUser(opts: { isAdmin: boolean }): boolean {
  const flag = process.env.VIRTUAL_STAGING_ENABLED === "true";
  return flag || opts.isAdmin;
}
