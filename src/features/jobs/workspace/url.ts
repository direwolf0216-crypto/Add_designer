"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Workspace state lives in the URL; this builds links and updates it without full reloads. */
export function useWorkspaceUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefWith = useCallback(
    (changes: Record<string, string | null | undefined>, { keepPage = false } = {}) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === undefined || v === "") p.delete(k);
        else p.set(k, v);
      }
      if (!keepPage && !("page" in changes)) p.delete("page");
      const qs = p.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const update = useCallback(
    (changes: Record<string, string | null | undefined>, opts?: { keepPage?: boolean }) => {
      router.replace(hrefWith(changes, opts), { scroll: false });
    },
    [router, hrefWith]
  );

  return { searchParams, hrefWith, update };
}
