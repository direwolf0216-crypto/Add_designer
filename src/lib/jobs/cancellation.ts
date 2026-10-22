/** Cancellation details kept on the job (customData) when it is moved to a Cancelled stage. */
export const CANCELLATION_KEY = "fld_cancellation";

export type Cancellation = {
  /** Cancellation charge kept back from the advance (0 when none). */
  charge: number;
  reason: string;
  /** ISO timestamp. */
  at: string;
  by?: string | null;
};

export const isCancelStage = (label: string | null | undefined) => /cancel/i.test(String(label ?? ""));

export function readCancellation(customData: unknown): Cancellation | null {
  const raw = customData && typeof customData === "object" ? (customData as Record<string, unknown>)[CANCELLATION_KEY] : null;
  const c = typeof raw === "string" ? safeParse(raw) : raw;
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const charge = Number(o.charge);
  return { charge: Number.isFinite(charge) && charge > 0 ? charge : 0, reason: typeof o.reason === "string" ? o.reason : "", at: typeof o.at === "string" ? o.at : "", by: typeof o.by === "string" ? o.by : null };
}

/** What goes back to the client: the advance less the cancellation charge, never below zero. */
export const refundDue = (advance: number, charge: number) => Math.max(0, Math.round((advance - charge) * 100) / 100);

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
