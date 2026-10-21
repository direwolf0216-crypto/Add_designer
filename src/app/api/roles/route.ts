import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { createRole, listRoles } from "@/lib/services/roles";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the role a name").max(40),
  description: z.string().trim().max(200).nullish(),
  permissions: z.array(z.string().max(64)).max(50),
});

export const GET = route(async () => {
  await requireAdmin();
  return NextResponse.json({ roles: await listRoles() }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Create a role. Cloning is a create with the source role's permissions. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const role = await createRole(admin.id, await parseJson(req, createSchema));
  return NextResponse.json({ role }, { status: 201 });
});
