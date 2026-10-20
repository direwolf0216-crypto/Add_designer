import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Node 22+ ships a global WebSocket; older runtimes need the `ws` polyfill.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

// Models that are soft-deleted via a nullable `deletedAt` column.
const SOFT_DELETE_MODELS = new Set(['Job', 'Transaction', 'Invoice']);
const SOFT_DELETE_READS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']);

function createBaseClient() {
  // Not validated at import time so `next build` can load route modules without database credentials.
  const connectionString = process.env.DATABASE_URL;

  // The WebSocket (Pool) adapter supports interactive and batch transactions, which Prisma 7 uses
  // internally for nested writes and relation `connect`. The HTTP adapter does not.
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function extend(base: PrismaClient) {
  return base.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Hide soft-deleted rows from list/count reads unless the caller filters on `deletedAt` explicitly.
          if (model && SOFT_DELETE_MODELS.has(model) && SOFT_DELETE_READS.has(operation)) {
            const a = (args ?? {}) as { where?: Record<string, unknown> };
            if (!a.where || !('deletedAt' in a.where)) {
              a.where = { ...a.where, deletedAt: null };
            }
            return query(a as typeof args);
          }
          return query(args);
        },
      },
    },
  });
}

export type AppPrismaClient = ReturnType<typeof extend>;
/** Client handed to `prisma.$transaction(async (tx) => …)` callbacks. */
export type TxClient = Parameters<Parameters<AppPrismaClient['$transaction']>[0]>[0];

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient; prisma?: AppPrismaClient };

/** Unextended client: only for libraries that need a raw PrismaClient (the NextAuth adapter). */
export const prismaBase = globalForPrisma.prismaBase ?? createBaseClient();
const prisma = globalForPrisma.prisma ?? extend(prismaBase);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.prisma = prisma;
}

export default prisma;
