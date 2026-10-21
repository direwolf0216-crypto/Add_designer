import "server-only";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import type { TxClient } from "@/lib/prisma";

/** Random human-readable reference such as `#Add-4F9A21C3`. 32 bits of entropy. */
export function randomRef(prefix: string, bytes = 4): string {
  return `${prefix}${randomBytes(bytes).toString("hex").toUpperCase()}`;
}

export const newJobNumber = () => randomRef("#Add-");
export const newTransactionRef = () => randomRef("#AddTXN-");
export const newOrderNumber = () => randomRef("#Addorder-");
export const newGroupId = () => randomRef("grp_", 8);

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Run an insert that uses a random unique reference, retrying with a fresh value on a collision.
 * Replaces check-then-insert loops, which race under concurrency.
 */
export async function withUniqueRetry<T>(make: (ref: string) => Promise<T>, gen: () => string, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await make(gen());
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/** Atomically increment a named counter and return the new value (e.g. invoice numbers). */
export async function nextCounter(db: TxClient, key: string): Promise<number> {
  const row = await db.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
