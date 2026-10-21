import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Demo data only: refuses to run against a database that already has transactions.
  if ((await prisma.transaction.count()) > 0) {
    throw new Error('Transactions already exist; refusing to seed demo data.');
  }

  const transactions: Prisma.TransactionCreateInput[] = [
    {
      amount: 15000.00,
      type: "INCOME",
      date: new Date(),
      category: "Printing Job",
      paymentMode: "Bank Transfer",
      description: "Flex banner advance - Ref: #FX-882",
      status: "SETTLED"
    },
    {
      amount: 4250.00,
      type: "EXPENSE",
      date: new Date(),
      category: "Paper Purchase",
      paymentMode: "UPI",
      description: "Paper & ink purchase - Sri Murugan Traders",
      status: "SETTLED"
    },
    {
      amount: 2840.00,
      type: "EXPENSE",
      date: new Date(),
      category: "Utilities",
      paymentMode: "Bank Transfer",
      description: "Electricity Bill - Oct - TNEB Portal",
      status: "PENDING"
    },
    {
      amount: 12000.00,
      type: "INCOME",
      date: new Date(new Date().setDate(new Date().getDate() - 1)),
      category: "Printing Job",
      paymentMode: "Cash",
      description: "Invitation card printing advance - 500 cards",
      status: "SETTLED"
    },
    {
      amount: 1500.00,
      type: "EXPENSE",
      date: new Date(new Date().setDate(new Date().getDate() - 2)),
      category: "Misc",
      paymentMode: "UPI",
      description: "Snacks and Refreshments",
      status: "SETTLED"
    }
  ];

  for (const t of transactions) {
    await prisma.transaction.create({ data: t });
  }

  console.log("Seeded transactions!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
