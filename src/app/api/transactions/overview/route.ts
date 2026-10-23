import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { loadLedgerOverview } from "@/lib/transactions/ledgerOverview";

export const GET = route(async (req) => {
  const user = await requirePermission("view_transactions");
  return NextResponse.json(await loadLedgerOverview(user, new URL(req.url).searchParams.get("week")));
});
