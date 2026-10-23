// Single-line and multi-line text fields start with a capital letter by default ("tenkasi" becomes
// "Tenkasi" as it's typed). Only the first letter changes; the rest is left exactly as typed, and
// other field types (email, phone, numbers...) are never touched.

const CAPITALISED_TYPES = new Set(["SINGLE_LINE", "MULTI_LINE"]);

/** Whether a field's text starts with a capital (on by default; a field can opt out with capitalize: false). */
export const capitalizesFirst = (field: { type?: string; capitalize?: boolean }) =>
  CAPITALISED_TYPES.has(field.type ?? "") && field.capitalize !== false;

/** The text with its first letter in upper case (leading spaces, digits and symbols are skipped). */
export function capitalizeFirst(text: string): string {
  const i = text.search(/\p{L}/u);
  if (i < 0) return text;
  const upper = text[i].toLocaleUpperCase("en-IN");
  return upper === text[i] ? text : text.slice(0, i) + upper + text.slice(i + 1);
}

/** Capitalise an input's value in place, keeping the caret where it was. */
export function capitalizeInput(el: HTMLInputElement | HTMLTextAreaElement) {
  const next = capitalizeFirst(el.value);
  if (next === el.value) return;
  const { selectionStart, selectionEnd } = el;
  el.value = next;
  if (selectionStart !== null && selectionEnd !== null) el.setSelectionRange(selectionStart, selectionEnd);
}
