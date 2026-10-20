import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";

export const GET = route<{ formKey: string }>(async (_req, { params }) => {
  await requireUser();
  const { formKey } = await params;

  const layout = await prisma.formLayout.findUnique({ where: { formKey } });
  if (layout) return NextResponse.json(layout);

  // Not configured in the DB yet: serve the built-in default.
  const defaultLayout = DEFAULT_LAYOUTS.find((l) => l.formKey === formKey);
  if (!defaultLayout) throw notFound("Layout not found");

  const now = new Date();
  return NextResponse.json({
    id: `default-${formKey}`,
    formKey: defaultLayout.formKey,
    name: defaultLayout.name,
    description: defaultLayout.description,
    schema: defaultLayout.schema,
    createdAt: now,
    updatedAt: now,
  });
});
