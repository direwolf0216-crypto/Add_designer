/** Remove everything created by scripts/perf/seed-large.ts. Same PERF_SEED_CONFIRM guard. */
import prisma from "../../src/lib/prisma";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  const confirm = process.env.PERF_SEED_CONFIRM;
  if (!confirm || !host.startsWith(confirm)) throw new Error(`Refusing to clean ${host}.`);
  const tx = await prisma.transaction.deleteMany({ where: { transactionId: { startsWith: "#PERFTX-" } } });
  const perfJobs = await prisma.job.findMany({ where: { jobNumber: { startsWith: "#PERF-" }, deletedAt: undefined }, select: { id: true } });
  const linked = await prisma.transaction.deleteMany({ where: { jobId: { in: perfJobs.map((j) => j.id) } } });
  const jobs = await prisma.job.deleteMany({ where: { jobNumber: { startsWith: "#PERF-" } } }); // orders, assignments, activity cascade
  const clients = await prisma.client.deleteMany({ where: { name: { startsWith: "Perf Client " }, jobs: { none: {} } } });
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: "@perf.test" } } });
  console.log({ transactions: tx.count + linked.count, jobs: jobs.count, clients: clients.count, users: users.count });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
