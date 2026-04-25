// Virtual Staging prompt library. Mirrors the Twilight pattern in
// src/lib/gemini.ts: a single PROMPT constant is too blunt here because
// staging has two axes (room type × furniture style), so we build the
// prompt from a room manifest plus a style modifier at request time.
//
// Model: OpenAI gpt-image-1 via /v1/images/edits. We swapped off
// google/nano-banana because it hallucinated architecture (removed
// doorways, hung art over windows) despite the preservation prompt.
// gpt-image-1 respects negative constraints much better on room edits.
// Per-call cost ~$0.17 at high quality; retail $2 per keeper render
// so the feature still clears ~90% margin.
//
// Ship behavior: staging runs behind the VIRTUAL_STAGING_ENABLED env
// flag. When the flag is off, only admin agencies can preview/purchase.

// Flat across every agency. Per-agency overrides were retired when
// we standardized on $2 universally.
export const STAGING_CREDIT_COST = 2;

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
      "A sectional or three-seat sofa against a solid wall (NOT in front of a window or doorway), two accent chairs angled toward it, a coffee table between them, an area rug that anchors the seating group, a floor lamp in a corner, one or two large houseplants. ONLY add wall art if there is a clearly solid wall section above the sofa with no windows, no doorways, no built-ins, and no fireplace. If the space above or around the sofa is a window or bay window, omit wall art entirely — the windows are the focal point.",
    avoid:
      "Do not add a fireplace, do not add a TV, do not add a ceiling fan, do not add additional windows or doors, do not add skylights, do not add extra walls, do not hang any art or mirror or shelf over any window, do not place the sofa in front of a doorway.",
  },
  bedroom: {
    add:
      "A single queen or king bed centered on the longest solid wall (NOT in front of a window or doorway), two matching nightstands with table lamps, a dresser against an opposite wall, a rug under the foot of the bed, neutral bedding with a throw folded at the foot. ONLY add minimal art above the headboard if the wall above the bed is clearly solid. If a window sits above or behind the bed, omit wall art.",
    avoid:
      "Do not add a second bed, do not add a ceiling fan, do not add a TV or monitor, do not add additional windows or doors, do not add a closet door that is not visible in the original, do not hang any art or mirror over any window, do not place the bed in front of a doorway.",
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

// Preservation-first opening. Paul-authored, intentionally aggressive.
// Treats the architecture as read-only pixels and frames the task as a
// strict furniture overlay. The self-check at the bottom of buildPrompt
// (recency position) is the second half of this — both halves matter.
const PRESERVATION_CORE = `CRITICAL INSTRUCTION: This is NOT an image redesign task. This is a strict furniture-overlay task. The base photo is locked and must remain architecturally identical to the source image.

You are only allowed to add removable furniture and decor on top of the existing room. You are NOT allowed to edit the room itself in any way.

ABSOLUTE DO NOT CHANGE RULES:
Do not alter, delete, cover, replace, crop, move, resize, repaint, regenerate, blur, blend, inpaint, outpaint, stylize, reinterpret, or obscure any existing structural or permanent object.

Protected objects include:
windows, glass doors, doors, walls, ceilings, floors, trim, molding, baseboards, outlets, switches, vents, recessed lights, chandeliers, cabinets, counters, sinks, faucets, appliances, stairs, railings, fireplaces, columns, beams, built-ins, mirrors, reflections, room openings, exterior scenery, shadows created by architecture.

WINDOW LOCK:
Every original window must remain visible in the exact same position, size, shape, frame, pane lines, transparency, brightness, and outdoor view. Never place artwork, beds, sofas, lamps, curtains, plants, or decor over a window. Never cover any portion of a window.

ZERO STRUCTURAL PIXEL CHANGE POLICY:
Treat all architecture as read-only pixels. Only add new pixels for furniture/decor in empty floor space or against blank wall space that contains no window, door, opening, fixture, or architectural detail.

If furniture placement conflicts with a protected object, move the furniture elsewhere.

Allowed additions only:
sofa, chairs, beds, tables, rugs, lamps, plants, pillows, tasteful wall art on blank uninterrupted wall sections only, small decor accessories.

Keep original camera angle, lens perspective, crop, room dimensions, and lighting logic identical.`;

export function buildStagingPrompt(opts: {
  roomType: string;
  style: StagingStyleId;
  hasInspiration?: boolean;
}): string {
  const manifest = ROOM_MANIFEST[opts.roomType];
  const style = styleById(opts.style);
  if (!manifest) {
    throw new Error(`No staging manifest for room type: ${opts.roomType}`);
  }
  if (!style) {
    throw new Error(`Unknown staging style: ${opts.style}`);
  }

  // When the user provides a style reference image, tell the model to
  // pull aesthetic cues from it — but explicitly forbid copying the
  // reference's room layout or architecture. The room being staged is
  // ALWAYS the first image; the reference is for tone/palette only.
  const inspirationClause = opts.hasInspiration
    ? `

A second reference image is attached as visual inspiration for the furniture style, color palette, textures, and overall mood. Use it for aesthetic cues only. Do not copy the reference image's room layout, window count, door positions, ceiling shape, or any architectural element. The room you are staging is the first image; the reference is the second image. Architecture of the first image is absolute.`
    : "";

  // Preservation-first. Room-specific furniture guidance and style
  // modifier come AFTER so the model has already committed to
  // preserving the architecture before picking what to add.
  // The two absolute rules are repeated at the END (recency bias)
  // because diffusion models weight both ends of the prompt and
  // re-stating the window/door rule right before generation starts
  // measurably cuts violations vs. stating it only at the top.
  return `${PRESERVATION_CORE}${inspirationClause}

Furniture and decor to add:
${manifest.add}

Furniture and elements NOT to add:
${manifest.avoid}

${style.modifier}

SELF-CHECK BEFORE FINAL OUTPUT:

1. Same number of windows as source image
2. Same number of doors/openings as source image
3. No windows covered or replaced
4. No fixtures removed
5. No wall/floor/ceiling geometry changed
6. Same perspective and crop
7. Only furniture added

If any check fails, discard result and regenerate.

Final output must look like the untouched original property photo with removable staged furniture added only.`;
}

// Feature gate helper. When the env flag is off, staging remains visible
// only to admin agencies (Paul, and any admin-flagged test account).
export function stagingEnabledForUser(opts: { isAdmin: boolean }): boolean {
  const flag = process.env.VIRTUAL_STAGING_ENABLED === "true";
  return flag || opts.isAdmin;
}
