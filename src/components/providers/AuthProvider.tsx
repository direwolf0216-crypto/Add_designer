"use client";

import { SessionProvider, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

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
  const { data, status } = useSession();
  const pathname = usePathname() || "";
  const revoked = status === "authenticated" && !data?.user;
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
