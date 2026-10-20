"use client";

import { mutate } from "swr";

export class FetchError extends Error {
  constructor(
    public status: number,
    message: string,
    public info?: unknown
  ) {
    super(message);
  }
}

/** SWR fetcher that throws on non-2xx so error bodies are never rendered as data. */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let info: unknown;
    try {
      info = await res.json();
    } catch {
      info = undefined;
    }
    const message = (info as { error?: string } | undefined)?.error || `Request failed (${res.status})`;
    throw new FetchError(res.status, message, info);
  }
  return res.json() as Promise<T>;
}

/** Normalise list endpoints that return either an array or `{ items }` / `{ users }` / `{ data }`. */
export function asList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["items", "users", "data"]) {
      if (Array.isArray(d[key])) return d[key] as T[];
    }
  }
  return [];
}

const startsWithAny = (prefixes: string[]) => (key: unknown) =>
  typeof key === "string" && prefixes.some((p) => key.startsWith(p));

/**
 * Revalidate every cached key under the given API prefixes. Cached data stays on screen while the
 * refetch runs (no skeleton flash), unlike `mutate(filter, undefined)`.
 */
export function invalidate(...prefixes: string[]) {
  return mutate(startsWithAny(prefixes));
}

export const invalidateJobs = () => invalidate("/api/jobs", "/api/dashboard", "/api/banner", "/api/search");
export const invalidateFinance = () =>
  invalidate("/api/transactions", "/api/dashboard", "/api/budget", "/api/jobs", "/api/banner", "/api/search");
export const invalidateAll = () =>
  invalidate("/api/jobs", "/api/transactions", "/api/dashboard", "/api/budget", "/api/banner", "/api/search", "/api/recycle-bin");
