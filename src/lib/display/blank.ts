// What a details page or printout leaves out instead of printing a placeholder: nothing, "N/A",
// "nil", a dash, or zero (also "₹ 0" / "Rs 0.00").

const PLACEHOLDERS = new Set(["", "n/a", "na", "nil", "null", "undefined", "none", "-", "—", "–"]);

/** True for values not worth showing. */
export function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return !Number.isFinite(value) || value === 0;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.every(isBlankValue);
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (PLACEHOLDERS.has(t)) return true;
    // A money or plain zero: "0", "0.00", "₹ 0", "Rs 0.00", "INR 0".
    const n = t.replace(/^(₹|rs\.?|inr)\s*/, "").replace(/,/g, "");
    return /^0+(\.0+)?$/.test(n);
  }
  return false;
}

/** A value as display text, or null when it's blank (or not something to print, like an object). */
export function displayText(value: unknown): string | null {
  if (isBlankValue(value)) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const parts = value.map(displayText).filter((p): p is string => p !== null);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}
