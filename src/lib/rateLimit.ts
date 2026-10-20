import "server-only";
import prisma from "@/lib/prisma";
import { tooManyRequests } from "@/lib/api/http";

/**
 * Fixed-window rate limit backed by the database so it holds across serverless instances.
 * Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const windowFloor = new Date(now.getTime() - windowMs);

  // Reset an expired window, then increment atomically.
  await prisma.rateLimit.updateMany({
    where: { key, windowStart: { lt: windowFloor } },
    data: { count: 0, windowStart: now },
  });
  const row = await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, windowStart: now },
    update: { count: { increment: 1 } },
  });
  return row.count <= limit;
}

/** Throws 429 when the limit is exceeded. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  if (!(await rateLimit(key, limit, windowMs))) throw tooManyRequests();
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  const get = (name: string): string | undefined => {
    if (!headers) return undefined;
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  return get("x-forwarded-for")?.split(",")[0]?.trim() || get("x-real-ip") || "unknown";
}

/** Delete expired windows; call from a cron. */
export async function purgeRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - olderThanMs) } } });
}
