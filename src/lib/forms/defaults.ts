// Default values for new records. A field's `defaultValue` is a literal, or one of the tokens below that
// the form resolves when it opens.
import type { FormField } from "./types";

export const DEFAULT_TOKENS = {
  today: "@today",
  now: "@now",
  me: "@me",
} as const;

export interface DefaultContext {
  /** yyyy-MM-dd */
  today: string;
  now?: Date;
  /** Signed-in user id, for USER_PICKLIST fields. */
  userId?: string | null;
}

const formatTime12 = (d: Date) => {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
};

/** The value a new record starts with for this field, or undefined when it has no default. */
export function resolveDefaultValue(field: Pick<FormField, "type" | "defaultValue">, ctx: DefaultContext): unknown {
  const raw = field.defaultValue;
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (raw === DEFAULT_TOKENS.today) return ctx.today;
  if (raw === DEFAULT_TOKENS.now) return formatTime12(ctx.now ?? new Date());
  if (raw === DEFAULT_TOKENS.me) return ctx.userId || undefined;
  if (field.type === "CHECKBOX") return raw === true || raw === "true";
  if (field.type === "MULTI_SELECT" || field.type === "MULTI_PICKLIST" || field.type === "MULTI_USER_PICKLIST") {
    if (Array.isArray(raw)) return raw;
    return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  }
  return raw;
}
