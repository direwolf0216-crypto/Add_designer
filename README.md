# Add designer — Printing press management

Job, payment and invoice management for a printing press: print jobs with configurable forms,
installment payments, a daily income/expense ledger, invoices (PDF), reminders and Google Drive attachments.

**Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 on Neon Postgres (WebSocket adapter) ·
NextAuth v4 (credentials) · SWR · Tailwind CSS 3 · Vitest · Playwright.

## Getting started

```bash
cp .env.example .env        # fill in DATABASE_URL and NEXTAUTH_SECRET at minimum
npm install                 # also runs `prisma generate`
npm run db:migrate:deploy   # apply migrations (see "Database" below first if the DB already exists)
npm run dev
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server. `build` never touches the database. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run test:e2e` | Playwright. Smoke tests are read-only; the jobs flow runs only with `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` against a disposable database. |
| `npm run db:migrate:dev` | Create a new migration from schema changes (development database only). |
| `npm run db:migrate:deploy` | Apply pending migrations. Run as a separate release step, never inside the build. |

## Database

Schema changes are versioned in `prisma/migrations`. The first migration, `0_init`, matches the schema
that was previously applied with `prisma db push`.

**An existing database (created by `db push`) must be baselined once** before deploying migrations:

```bash
npx prisma migrate resolve --applied 0_init
npm run db:migrate:deploy
```

Never run `prisma db push --accept-data-loss` against a database with real data. Scripts in
`scripts/oneoff/` are historical one-off data fixes and may wipe data — read them before running.

## Architecture notes

- **Auth & permissions.** Every API route and server action authenticates and authorises on the server
  (`src/lib/auth/session.ts`: `requireUser`, `requirePermission`, `requireAdmin`). The role matrix
  (`src/lib/permissions.ts`) is shared with the UI (`usePermissions`), which only hides controls.
  Sessions re-check role/status every minute, so deactivated users lose access promptly.
- **API conventions.** Handlers are wrapped in `route()` (`src/lib/api/http.ts`), validate input with zod
  and return `{ error, details? }` on failure without leaking internals.
- **Data integrity.** Saving a job (client + job + order + installment payments) is one database
  transaction (`src/lib/services/jobs.ts`). A job's balance is always derived from its non-deleted INCOME
  payments. Jobs, transactions and invoices are soft-deleted (a Prisma extension hides them from list
  reads) and restored/purged through `src/lib/services/recycleBin.ts`.
- **Dates.** The business runs in IST: use `src/lib/dates.ts` for day/week/month boundaries. Job dates are
  calendar dates stored as UTC midnight.
- **Client data.** SWR with the shared `fetcher` (throws on non-2xx) and `invalidate*` helpers in
  `src/lib/swr.ts`. Job list filters live in the URL and are applied in the database query.

## Operations

- **Cron:** call `/api/cron/reminders`, `/api/cron/daily-reminders` and `/api/cron/purge-recycle-bin`
  with `Authorization: Bearer $CRON_SECRET` (they refuse to run when it is unset).
- **Docker:** `docker build .` produces a standalone image (`node server.js`, port 3000, health check on
  `/api/ping`). Run migrations separately before rolling out a new image.
- **Security headers** are set in `next.config.ts`; route protection lives in `src/proxy.ts`.
