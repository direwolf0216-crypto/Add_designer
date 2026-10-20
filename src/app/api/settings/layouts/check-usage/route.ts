import { NextResponse } from "next/server";
import { TransactionType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";

const bodySchema = z.object({
  formKey: z.string().min(1).max(64),
  fieldId: z.string().min(1).max(100),
  value: z.string().min(1).max(200),
});

async function countUsage(formKey: string, fieldId: string, value: string): Promise<number> {
  if (formKey === "JOB_FORM") {
    if (fieldId === "fld_b_category") return prisma.job.count({ where: { category: value } });
    if (fieldId === "fld_b_status") return prisma.job.count({ where: { status: value } });
  } else if (formKey === "TRANSACTION_FORM") {
    if (fieldId === "fld_tx_type") {
      const type = Object.values(TransactionType).find((t) => t === value);
      return type ? prisma.transaction.count({ where: { type } }) : 0;
    }
    if (fieldId === "fld_tx_category") return prisma.transaction.count({ where: { category: value } });
    if (fieldId === "fld_tx_mode") return prisma.transaction.count({ where: { paymentMode: value } });
  }
  return 0;
}

export const POST = route(async (req) => {
  await requireAdmin();
  const { formKey, fieldId, value } = await parseJson(req, bodySchema);

  const count = await countUsage(formKey, fieldId, value);
  return NextResponse.json({ inUse: count > 0, count });
});
