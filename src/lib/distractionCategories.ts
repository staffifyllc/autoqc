/**
 * Canonical list of distraction categories for the Premium AI
 * distraction removal feature. Kept in sync with the Python detector
 * at lambda/qc_engine/checks/distraction_removal.py.
 */

export type DistractionCategory = {
  id: string;
  label: string;
  description: string;
  risky: boolean;
};

export const DISTRACTION_CATEGORIES: DistractionCategory[] = [
  // Safe defaults: transient clutter that an agent can reasonably
  // remove before listing without misrepresenting the property.
  {
    id: "trash_bin",
    label: "Trash Bins",
    description: "Wheelie bins, curbside trash cans",
    risky: false,
  },
  {
    id: "garbage_can",
    label: "Garbage Cans",
    description: "Free standing outdoor garbage cans",
    risky: false,
  },
  {
    id: "recycling_bin",
    label: "Recycling Bins",
    description: "Blue or green recycling containers",
    risky: false,
  },
  {
    id: "garden_hose",
    label: "Garden Hoses",
    description: "Hoses coiled or running across the yard",
    risky: false,
  },
  {
    id: "kids_toy",
    label: "Kids Toys",
    description: "Tricycles, outdoor toys, play equipment left out",
    risky: false,
  },
  {
    id: "pool_float",
    label: "Pool Floats",
    description: "Inflatables and loose pool gear",
    risky: false,
  },
  {
    id: "extension_cord",
    label: "Extension Cords",
    description: "Cords running across floors or walls",
    risky: false,
  },
  {
    id: "cables",
    label: "Visible Cables",
    description: "Loose electrical and data cabling",
    risky: false,
  },
  {
    id: "porta_potty",
    label: "Porta Potties",
    description: "Portable toilets on or near the property",
    risky: false,
  },
  {
    id: "construction_equipment",
    label: "Construction Equipment",
    description: "Ladders, scaffolding, loose building materials",
    risky: false,
  },

  // Risky: permanent or structural. Removing these can raise MLS or NAR
  // ethics concerns in some jurisdictions. Agents must opt in explicitly.
  {
    id: "parked_car",
    label: "Parked Cars",
    description: "Vehicles in the driveway or at the curb",
    risky: true,
  },
  {
    id: "satellite_dish",
    label: "Satellite Dishes",
    description: "Roof or wall mounted dishes. Permanent feature.",
    risky: true,
  },
  {
    id: "power_line",
    label: "Power Lines",
    description: "Overhead power and utility lines. Permanent feature.",
    risky: true,
  },
];

export const ALL_DISTRACTION_CATEGORIES = DISTRACTION_CATEGORIES.map(
  (c) => c.id
);

export const SAFE_DISTRACTION_CATEGORIES = DISTRACTION_CATEGORIES.filter(
  (c) => !c.risky
).map((c) => c.id);

export const RISKY_DISTRACTION_CATEGORIES = DISTRACTION_CATEGORIES.filter(
  (c) => c.risky
).map((c) => c.id);

export function filterValidDistractionCategories(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(ALL_DISTRACTION_CATEGORIES);
  return Array.from(
    new Set(
      input.filter((v): v is string => typeof v === "string" && allowed.has(v))
    )
  );
}

export function prettyDistractionLabel(id: string): string {
  const match = DISTRACTION_CATEGORIES.find((c) => c.id === id);
  if (match) return match.label;
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const RISKY_TOOLTIP =
  "Removing permanent features like satellite dishes or power lines may violate MLS ethics rules in some jurisdictions. Enable only with agent approval.";
