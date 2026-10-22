import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin, requireUser } from "@/lib/auth/session";

const formKeySchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid formKey");

// Loose on purpose: the builder stores many optional per-field settings. Older default fields use `label`.
const fieldSchema = z.looseObject({
  id: z.string().min(1).max(100),
  name: z.string().max(200).optional(),
  label: z.string().max(200).optional(),
  type: z.string().min(1).max(50),
  placeholder: z.string().max(200).optional(),
  sizeUnits: z.array(z.string().trim().min(1).max(8)).max(12).optional(),
  defaultUnit: z.string().trim().max(8).optional(),
});

const sectionSchema = z.looseObject({
  id: z.string().min(1).max(100),
  title: z.string().max(200).optional(),
  fields: z.array(fieldSchema).max(200),
});

const layoutSchema = z.looseObject({
  sections: z.array(sectionSchema).max(50),
});

const bodySchema = z.object({
  formKey: formKeySchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullish(),
  schema: layoutSchema,
});

export const GET = route(async () => {
  await requireUser();
  const layouts = await prisma.formLayout.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(layouts);
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const { formKey, name, description, schema: parsedSchema } = await parseJson(req, bodySchema);
  const schema = parsedSchema as Prisma.InputJsonValue;

  const updated = await prisma.formLayout.upsert({
    where: { formKey },
    update: { name, description: description ?? null, schema },
    create: { formKey, name, description: description ?? null, schema },
  });

  return NextResponse.json(updated);
});
