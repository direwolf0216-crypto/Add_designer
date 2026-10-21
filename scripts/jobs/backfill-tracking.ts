/**
 * One-off: fill Job.stage / Job.dueDate for jobs saved before those columns existed (migration 4).
 * Safe to re-run; only writes rows whose derived values differ.
 *
 *   node --env-file=.env --import tsx scripts/jobs/backfill-tracking.ts
 */
import prisma from "../../src/lib/prisma";
import { deriveJobTracking } from "../../src/lib/jobs/tracking";

async function main() {
  const layout = await prisma.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } });
  let cursor: string | undefined;
  let updated = 0;
  for (;;) {
    const jobs = await prisma.job.findMany({
      where: { deletedAt: undefined },
      select: { id: true, customData: true, stage: true, dueDate: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (jobs.length === 0) break;
    cursor = jobs[jobs.length - 1].id;
    const changes = jobs
      .map((j) => ({ j, t: deriveJobTracking(j.customData, layout?.schema as Parameters<typeof deriveJobTracking>[1]) }))
      .filter(({ j, t }) => j.stage !== t.stage || (j.dueDate?.getTime() ?? null) !== (t.dueDate?.getTime() ?? null));
    await prisma.$transaction(changes.map(({ j, t }) => prisma.job.update({ where: { id: j.id }, data: t })));
    updated += changes.length;
  }
  console.log(`backfilled ${updated} jobs`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
