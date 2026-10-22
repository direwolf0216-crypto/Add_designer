// Job sizes are stored as one string, e.g. "3 x 6 ft" or "120 x 60 cm": the dimensions the user typed
// plus a unit picked from the field's list. `parseAreaSqFt` (pricing) reads the same string, so
// per-sq-ft lines price correctly for every unit it knows (ft, in, cm, mm, m, yd).

/** Units a Size field offers when the layout does not define its own. */
export const DEFAULT_SIZE_UNITS = ["ft", "in", "cm", "mm", "m"];

/** Unit used when a size string has none: feet, which is also what pricing assumes. */
export const DEFAULT_SIZE_UNIT = "ft";

/** Units `parseAreaSqFt` can convert, so per-sq-ft pricing works for them. */
export const CONVERTIBLE_UNITS = ["ft", "in", "cm", "mm", "m", "yd", "sqft", "sqm"];

/** Area units: the size is a single number (the area itself), not two dimensions. */
export const AREA_UNITS = ["sqft", "sqm"];

export const isAreaUnit = (unit: string) => AREA_UNITS.includes(unit.toLowerCase().replace(/[\s.]/g, ""));

const ALIASES: Record<string, string> = {
  feet: "ft", foot: "ft", "'": "ft",
  inch: "in", inches: "in", '"': "in",
  cms: "cm",
  mtr: "m", mtrs: "m", meter: "m", meters: "m", metre: "m", metres: "m",
  yard: "yd", yards: "yd",
  "sq.ft": "sqft", "sq ft": "sqft", sqf: "sqft", "ft²": "sqft", "sq.m": "sqm", "sq m": "sqm", "m²": "sqm",
};

const TRAILING_UNIT = /^(.*?)\s*([a-z"'][a-z"'.\-/²]*)$/i;

type SizeFieldLike = { sizeUnits?: string[]; defaultUnit?: string } | null | undefined;

/** Units the picker offers for a field: its own list when it has one, else the defaults. */
export function unitsFor(field: SizeFieldLike): string[] {
  const own = (field?.sizeUnits ?? []).map((u) => u.trim()).filter(Boolean);
  return own.length ? Array.from(new Set(own)) : DEFAULT_SIZE_UNITS;
}

/** The unit preselected for a new size on this field. */
export function defaultUnitFor(field: SizeFieldLike): string {
  const units = unitsFor(field);
  const wanted = field?.defaultUnit?.trim();
  if (wanted && units.some((u) => u.toLowerCase() === wanted.toLowerCase())) return units.find((u) => u.toLowerCase() === wanted.toLowerCase())!;
  return units.includes(DEFAULT_SIZE_UNIT) ? DEFAULT_SIZE_UNIT : units[0];
}

/**
 * "120 x 60 cm" → dimensions "120 x 60" and unit "cm". A trailing token is a unit when it is one of the
 * field's units (any case) or a known alias; a bare "3 x 6" gets the field's default unit.
 */
export function splitSize(value: unknown, field?: SizeFieldLike): { dims: string; unit: string } {
  const text = value === null || value === undefined ? "" : String(value).trim();
  const fallback = defaultUnitFor(field);
  const m = text.match(TRAILING_UNIT);
  if (m) {
    const token = m[2].replace(/\.$/, "");
    const lower = token.toLowerCase();
    const own = unitsFor(field).find((u) => u.toLowerCase() === lower);
    const unit = own ?? ALIASES[lower] ?? (CONVERTIBLE_UNITS.includes(lower) ? lower : undefined);
    if (unit) return { dims: m[1].trim(), unit };
  }
  return { dims: text, unit: fallback };
}

/** The stored size string: dimensions + unit, or "" when no dimensions were typed. */
export function composeSize(dims: string, unit: string): string {
  const d = dims.trim();
  return d ? `${d} ${unit}` : "";
}

/** Layout field that holds the size: the Size type, or an older text field named "Size". */
export function isSizeLayoutField(field: { type?: string; name?: string; role?: string } | null | undefined): boolean {
  if (!field) return false;
  return field.type === "SIZE" || field.role === "size" || !!field.name?.toLowerCase().includes("size");
}

/** "3 x 6", "120×60 cm", "4*6 ft": two numbers joined by x / × / *. Used to find a size saved under a field that no longer exists. */
export function looksLikeSize(value: unknown): boolean {
  return typeof value === "string" && /^\s*\d+(?:\.\d+)?\s*(?:[a-z"']+)?\s*[x×*]\s*\d+(?:\.\d+)?/i.test(value);
}
