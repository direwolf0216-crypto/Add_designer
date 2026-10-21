import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { deleteRole, updateRole } from "@/lib/services/roles";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    description: z.string().trim().max(200).nullish(),
    permissions: z.array(z.string().max(64)).max(50).optional(),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined || d.permissions !== undefined, { message: "Nothing to update" });

/** `id` is "STAFF" for the Staff role, otherwise a custom role id. */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  await updateRole(admin.id, id, await parseJson(req, updateSchema));
  return NextResponse.json({ success: true });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  // ?reassignTo=STAFF | custom:<id> moves the people who still have this role.
  await deleteRole(admin.id, id, new URL(req.url).searchParams.get("reassignTo"));
  return NextResponse.json({ success: true });
});
