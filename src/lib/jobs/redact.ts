import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { FormLayout } from "@/lib/forms/types";
import { moneyKeys, withoutMoney } from "./amounts";

/** Money keys of the current job layout (one small query). */
export async function jobMoneyKeys() {
  const layout = await prisma.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } });
  return moneyKeys(layout?.schema as FormLayout | null);
}

const asObject = (v: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

/** A job as seen by a role without "See amounts": no order totals, no payments, no money fields. */
export function redactJobAmounts<T extends { customData?: Prisma.JsonValue | null; order?: unknown; transactions?: unknown }>(job: T, keys: Set<string>): T {
  return {
    ...job,
    ...("order" in job ? { order: null } : {}),
    ...("transactions" in job ? { transactions: [] } : {}),
    ...("customData" in job ? { customData: withoutMoney(asObject(job.customData), keys) as Prisma.JsonValue } : {}),
  };
}
