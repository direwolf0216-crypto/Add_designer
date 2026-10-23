// The server's guard on job money: a save's package must be what its own line items add up to.
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { FormLayout } from "@/lib/forms/types";
import { packageFromSavedValues } from "./pricing";

const rs = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Why a save's package can't be stored, or null when it can. The package must not be negative, and
 * when line rates drive it, it must equal Σ rate × quantity (× area in each line's saved unit) minus the
 * discount, to within a paisa. This stops a form bug or a tampered request from storing a different
 * amount than Job Details and the invoice will show.
 */
export function packageMismatch(packageAmount: number, customData: Record<string, unknown>, layout: FormLayout | null | undefined): string | null {
  if (!Number.isFinite(packageAmount)) return "The total amount isn't a number.";
  if (packageAmount < 0) return "The total amount can't be negative.";
  const expected = packageFromSavedValues(customData, layout, JOB_FORM_FIELD_MAP);
  if (expected === null) return null;
  if (Math.abs(Math.round(packageAmount * 100) - Math.round(expected * 100)) <= 1) return null;
  return `The total (${rs(packageAmount)}) doesn't match the line items (${rs(expected)}). Nothing was saved; reopen the job and try again.`;
}
