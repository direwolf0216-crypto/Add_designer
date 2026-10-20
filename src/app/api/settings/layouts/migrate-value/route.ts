import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest, parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";

const bodySchema = z
  .object({
    formKey: z.string().min(1).max(64),
    fieldId: z.string().min(1).max(100),
    oldValue: z.string().min(1).max(200),
    newValue: z.string().trim().min(1).max(200),
  })
  .refine((b) => b.oldValue !== b.newValue, { message: "New value must differ from the old value", path: ["newValue"] });

// Only free-text String columns can be renamed in bulk. Transaction.type is an enum (INCOME/EXPENSE)
// that the money logic depends on, so it is deliberately not migratable.
type Migrator = (oldValue: string, newValue: string) => Promise<{ count: number }>;
const MIGRATORS: Record<string, Record<string, Migrator>> = {
  JOB_FORM: {
    fld_b_category: (oldValue, newValue) =>
      prisma.job.updateMany({ where: { category: oldValue }, data: { category: newValue } }),
    fld_b_status: (oldValue, newValue) =>
      prisma.job.updateMany({ where: { status: oldValue }, data: { status: newValue } }),
  },
  TRANSACTION_FORM: {
    fld_tx_category: (oldValue, newValue) =>
      prisma.transaction.updateMany({ where: { category: oldValue }, data: { category: newValue } }),
    fld_tx_mode: (oldValue, newValue) =>
      prisma.transaction.updateMany({ where: { paymentMode: oldValue }, data: { paymentMode: newValue } }),
  },
};

export const POST = route(async (req) => {
  await requireAdmin();
  const { formKey, fieldId, oldValue, newValue } = await parseJson(req, bodySchema);

  const migrate = Object.hasOwn(MIGRATORS, formKey) && Object.hasOwn(MIGRATORS[formKey], fieldId)
    ? MIGRATORS[formKey][fieldId]
    : undefined;
  if (!migrate) throw badRequest("Values of this field cannot be migrated");

  const { count } = await migrate(oldValue, newValue);
  return NextResponse.json({ success: true, updatedCount: count });
});
