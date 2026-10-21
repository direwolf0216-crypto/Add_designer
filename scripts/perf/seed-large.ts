/**
 * Seed a large synthetic dataset for performance testing. TEST DATABASES ONLY.
 *
 *   PERF_SEED_CONFIRM=<db-host-prefix> node --env-file=.env --import tsx scripts/perf/seed-large.ts
 *
 * Refuses to run unless PERF_SEED_CONFIRM matches the start of the DATABASE_URL host. All rows are tagged
 * (#PERF- job numbers, #PERFTX- transaction ids, "Perf Client" names, @perf.test emails) and removed by
 * scripts/perf/cleanup.ts.
 */
import bcrypt from "bcryptjs";
import prisma from "../../src/lib/prisma";

const JOBS = Number(process.env.PERF_JOBS ?? 5000);
const TX = Number(process.env.PERF_TX ?? 20000);
const CATEGORIES = ["Flex Printing", "Vinyl Printing", "Offset Printing", "Visiting Cards", "Invitations", "ID Cards", "Sticker Print", "Book Printing"];
const STATUSES = ["Confirmed", "Pending", "Designing", "Printing", "Printing Completed", "Delivered"];
const BOARD = ["Pending", "Designing", "Printing", "Ready for Delivery", "Delivered"];
const MODES = ["Cash", "UPI", "Bank Transfer"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const day = (offset: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset));
};

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  const confirm = process.env.PERF_SEED_CONFIRM;
  if (!confirm || !host.startsWith(confirm)) {
    throw new Error(`Refusing to seed ${host}. Set PERF_SEED_CONFIRM to the start of the test DB host.`);
  }

  const password = await bcrypt.hash(process.env.PERF_USER_PASSWORD ?? "PerfTest#2026", 12);
  const users: { id: string }[] = [];
  for (const [email, name, role] of [
    ["perf.admin@perf.test", "Perf Admin", "ADMIN"],
    ["perf.staff@perf.test", "Perf Staff", "STAFF"],
    ["perf.designer@perf.test", "Perf Designer", "DESIGNER"],
  ] as const) {
    users.push(await prisma.user.upsert({ where: { email }, update: { role, status: "ACTIVE", password }, create: { email, name, role, status: "ACTIVE", password } }));
  }

  const clientCount = Math.ceil(JOBS / 5);
  await prisma.client.createMany({
    data: Array.from({ length: clientCount }, (_, i) => ({ name: `Perf Client ${i + 1}`, phone: `9${String(100000000 + i).slice(0, 9)}` })),
  });
  const clients = await prisma.client.findMany({ where: { name: { startsWith: "Perf Client " } }, select: { id: true } });

  for (let start = 0; start < JOBS; start += 1000) {
    const batch = Array.from({ length: Math.min(1000, JOBS - start) }, (_, k) => {
      const i = start + k;
      return {
        jobNumber: `#PERF-${String(i + 1).padStart(6, "0")}`,
        clientId: pick(clients).id,
        category: pick(CATEGORIES),
        status: pick(STATUSES),
        date: day(Math.floor(Math.random() * 240) - 180),
        time: "10:00 AM",
        location: pick(["Tenkasi", "Ayikudi", "Kadayanallur", "Shencottai"]),
        customData: { fld_b_status: pick(BOARD), field_qty: String(50 + Math.floor(Math.random() * 950)) },
      };
    });
    await prisma.job.createMany({ data: batch });
    console.log(`jobs ${Math.min(start + 1000, JOBS)}/${JOBS}`);
  }
  const jobs = await prisma.job.findMany({ where: { jobNumber: { startsWith: "#PERF-" } }, select: { id: true } });

  await prisma.order.createMany({
    data: jobs.map((j) => {
      const pkg = 500 + Math.floor(Math.random() * 50000);
      return { jobId: j.id, package: pkg, advance: 0, due: pkg };
    }),
    skipDuplicates: true,
  });
  // ~40% of jobs assigned to staff, ~20% to the designer.
  await prisma.jobAssignment.createMany({
    data: jobs.flatMap((j) => [
      ...(Math.random() < 0.4 ? [{ jobId: j.id, userId: users[1].id }] : []),
      ...(Math.random() < 0.2 ? [{ jobId: j.id, userId: users[2].id }] : []),
    ]),
    skipDuplicates: true,
  });

  for (let start = 0; start < TX; start += 2000) {
    const batch = Array.from({ length: Math.min(2000, TX - start) }, (_, k) => {
      const i = start + k;
      const income = Math.random() < 0.6;
      const linked = income && Math.random() < 0.7;
      return {
        transactionId: `#PERFTX-${String(i + 1).padStart(7, "0")}`,
        amount: 50 + Math.floor(Math.random() * 15000),
        type: income ? ("INCOME" as const) : ("EXPENSE" as const),
        category: income ? pick(["Printing Job", "Xerox", "Printout", "Design Charges"]) : pick(["Paper Purchase", "Ink/Toner", "Rent", "Salary", "Maintenance"]),
        paymentMode: pick(MODES),
        date: new Date(Date.now() - Math.floor(Math.random() * 180 * 86400000)),
        status: "SETTLED",
        jobId: linked ? pick(jobs).id : null,
        userId: users[0].id,
        description: income ? "Perf income" : "Perf expense",
      };
    });
    await prisma.transaction.createMany({ data: batch });
    console.log(`transactions ${Math.min(start + 2000, TX)}/${TX}`);
  }
  console.log("done. users: perf.admin@perf.test / perf.staff@perf.test / perf.designer@perf.test");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
