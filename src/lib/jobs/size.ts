// Job sizes are stored as one string, e.g. "3 x 6 ft" or "120 x 60 cm": the dimensions the user typed
// plus a unit the form picks. `parseAreaSqFt` (pricing) reads the same string, so per-sq-ft lines price
// correctly whichever unit was chosen.

export type SizeUnit = "ft" | "in" | "cm" | "mm" | "m";

export const SIZE_UNITS: { value: SizeUnit; label: string; title: string }[] = [
  { value: "ft", label: "ft", title: "Feet" },
  { value: "in", label: "in", title: "Inches" },
  { value: "cm", label: "cm", title: "Centimetres" },
  { value: "mm", label: "mm", title: "Millimetres" },
  { value: "m", label: "m", title: "Metres" },
];

/** Unit used when a size has none: feet, the shop's default and what pricing assumes. */
export const DEFAULT_SIZE_UNIT: SizeUnit = "ft";

const ALIASES: Record<string, SizeUnit> = {
  ft: "ft", feet: "ft", foot: "ft", "'": "ft",
  in: "in", inch: "in", inches: "in", '"': "in",
  cm: "cm", cms: "cm",
  mm: "mm",
  m: "m", mtr: "m", mtrs: "m", meter: "m", meters: "m", metre: "m", metres: "m",
};

const TRAILING_UNIT = /^(.*?)\s*(ft|feet|foot|'|in|inch|inches|"|cms?|mm|m|mtrs?|meters?|metres?)\.?\s*$/i;

/** "120 x 60 cm" → dimensions "120 x 60" and unit "cm"; a bare "3 x 6" is feet. */
export function splitSize(value: unknown): { dims: string; unit: SizeUnit } {
  const text = value === null || value === undefined ? "" : String(value).trim();
  const m = text.match(TRAILING_UNIT);
  if (m) {
    const unit = ALIASES[m[2].toLowerCase()];
    if (unit) return { dims: m[1].trim(), unit };
  }
  return { dims: text, unit: DEFAULT_SIZE_UNIT };
}

/** The stored size string: dimensions + unit, or "" when no dimensions were typed. */
export function composeSize(dims: string, unit: SizeUnit): string {
  const d = dims.trim();
  return d ? `${d} ${unit}` : "";
}
