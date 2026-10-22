"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { Viewer } from "@/lib/forms/audience";

/** Who is looking at a form: role, custom role and team memberships. Null until the session is known. */
export function useViewer(): Viewer | null {
  const { data: session } = useSession();
  const { data } = useSWR<{ teams: { id: string }[] }>(session?.user ? "/api/me/teams" : null, fetcher, { revalidateOnFocus: false });
  const role = session?.user?.role;
  const customRoleId = session?.user?.customRoleId ?? null;
  const teamKey = (data?.teams ?? []).map((t) => t.id).join(",");
  return useMemo(() => (role ? { role, customRoleId, teamIds: teamKey ? teamKey.split(",") : [] } : null), [role, customRoleId, teamKey]);
}
