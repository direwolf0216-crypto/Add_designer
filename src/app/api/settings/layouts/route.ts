import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";

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
  /** "draft" keeps the live form as is; "publish" (default) makes it live and records a version. */
  action: z.enum(["draft", "publish"]).optional(),
  /** Shown in the version history. */
  note: z.string().trim().max(300).optional(),
});

export const GET = route(async () => {
  await requireUser();
  const layouts = await prisma.formLayout.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(layouts);
});

export const PUT = route(async (req) => {
  const user = await requireAdmin();
  const { formKey, name, description, schema: parsedSchema, action = "publish", note } = await parseJson(req, bodySchema);
  const schema = parsedSchema as Prisma.InputJsonValue;
  const now = new Date();

  if (action === "draft") {
    // A layout that has never been saved goes live with its built-in default (or this draft when there is none),
    // so the forms keep working while the draft is being edited.
    const fallback = (DEFAULT_LAYOUTS.find((l) => l.formKey === formKey)?.schema ?? parsedSchema) as Prisma.InputJsonValue;
    const updated = await prisma.formLayout.upsert({
      where: { formKey },
      update: { name, description: description ?? null, draftSchema: schema, draftUpdatedAt: now },
      create: { formKey, name, description: description ?? null, schema: fallback, draftSchema: schema, draftUpdatedAt: now },
    });
    return NextResponse.json(updated);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const last = await tx.formLayoutVersion.findFirst({ where: { formKey }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    const row = await tx.formLayout.upsert({
      where: { formKey },
      update: { name, description: description ?? null, schema, draftSchema: Prisma.DbNull, draftUpdatedAt: null, publishedVersion: version },
      create: { formKey, name, description: description ?? null, schema, publishedVersion: version },
    });
    await tx.formLayoutVersion.create({
      data: { formKey, version, name, description: description ?? null, schema, authorId: user.id, authorName: user.name ?? user.email ?? null, note: note || null },
    });
    return row;
  });
  return NextResponse.json(updated);
});
