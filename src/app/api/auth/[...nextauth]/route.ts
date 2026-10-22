import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions } from "@/lib/auth";

// Options are built per request: the Google Drive provider appears once an admin saves the shop's
// Google Cloud credentials in Settings, with no restart and no environment variables.
async function handler(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return NextAuth(req, ctx, await getAuthOptions());
}

export { handler as GET, handler as POST };
