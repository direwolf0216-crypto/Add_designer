import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { loadWorkspaceExport } from "@/lib/jobs/workspace";

/** Jobs matching the workspace filters (same URL params as /jobs), for CSV/PDF export. */
export const GET = route(async (req) => {
  const user = await requirePermission("view_jobs");
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return NextResponse.json(await loadWorkspaceExport(user, params), { headers: { "Cache-Control": "private, no-store" } });
});
