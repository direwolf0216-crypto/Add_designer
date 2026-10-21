import "server-only";
import type { JobActivityType, Prisma } from "@prisma/client";
import type { TxClient } from "@/lib/prisma";
import type { FieldChange } from "@/lib/jobs/diffJob";

export type ActivityInput = {
  jobId: string;
  actorId?: string | null;
  type: JobActivityType;
  summary: string;
  changes?: FieldChange[];
};

/**
 * Append to a job's activity stream. Always call with the same `tx` as the change being described, so an
 * entry exists exactly when the change committed.
 */
export async function recordJobActivity(tx: TxClient, input: ActivityInput) {
  await tx.jobActivity.create({
    data: {
      jobId: input.jobId,
      actorId: input.actorId ?? null,
      type: input.type,
      summary: input.summary.slice(0, 500),
      changes: input.changes?.length ? (input.changes as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}

/** Label for a payment in activity summaries, e.g. "₹5,000 (UPI)". */
export function paymentLabel(amount: number, paymentMode?: string | null) {
  const value = `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return paymentMode ? `${value} (${paymentMode})` : value;
}
