"use client";

import { SessionProvider, signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Refresh the session cookie a little more often than the server's 60s role/permission recheck, so page
// and API requests reuse a fresh token instead of re-reading the user on every request.
const SESSION_REFRESH_SECONDS = 55;
const PUBLIC = ["/login", "/reset-password", "/privacy", "/terms"];

/**
 * A session the server has revoked (account deleted or deactivated, or a cookie issued against another
 * database) comes back "authenticated" but without a user. Sign out to the login page straight away
 * rather than leaving a shell whose every request fails; the proxy does the same on the next navigation.
 */
function RevokedSessionGuard() {
  const { data, status, update } = useSession();
  const pathname = usePathname() || "";
  const router = useRouter();
  const revoked = status === "authenticated" && !data?.user;
  // Permission a page needs; when a refreshed session no longer has it, move to the jobs board.
  const needs = pathname.startsWith("/dashboard") ? "view_analytics" : pathname.startsWith("/transactions") ? "view_transactions" : pathname.startsWith("/settings") ? "admin" : null;
  const role = data?.user?.role;
  const perms = data?.user?.permissions;
  const forbidden = status === "authenticated" && !!data?.user && role !== "ADMIN" && !!needs && (needs === "admin" || !perms?.includes(needs));
  useEffect(() => {
    if (forbidden) router.replace("/jobs");
  }, [forbidden, router]);
  // One re-read of role and permissions per full page load, so a refresh shows permission changes at once.
  const refreshed = useRef(false);
  useEffect(() => {
    if (status === "authenticated" && !refreshed.current) {
      refreshed.current = true;
      void update();
    }
  }, [status, update]);
  useEffect(() => {
    if (revoked && !PUBLIC.some((p) => pathname.startsWith(p))) {
      void signOut({ callbackUrl: `/login?callbackUrl=${encodeURIComponent(pathname)}` });
    }
  }, [revoked, pathname]);
  return null;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider refetchInterval={SESSION_REFRESH_SECONDS}>
      <RevokedSessionGuard />
      {children}
    </SessionProvider>
  );
}
