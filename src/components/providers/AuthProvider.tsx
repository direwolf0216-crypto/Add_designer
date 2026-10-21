"use client";

import { SessionProvider } from "next-auth/react";

// Refresh the session cookie a little more often than the server's 60s role/permission recheck, so page
// and API requests reuse a fresh token instead of re-reading the user on every request.
const SESSION_REFRESH_SECONDS = 55;

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider refetchInterval={SESSION_REFRESH_SECONDS}>{children}</SessionProvider>;
}
