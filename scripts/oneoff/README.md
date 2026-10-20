# One-off scripts

Historical data-fix, seed and load-test scripts. Most of them connect directly
to whatever `DATABASE_URL` points at and **mutate or wipe data** — read a script
before running it and never point it at production by accident.

Schema changes belong in `prisma/migrations` (see the root README), not here.
