import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrateLegacyTransactions() {
  console.log('Finding jobs with advance amounts but no transactions...');
  const jobs = await prisma.job.findMany({
    include: {
      order: true,
      transactions: true,
    }
  });

  let migratedCount = 0;

  for (const job of jobs) {
    // If it has an order with advance > 0 AND it doesn't have any associated transactions yet
    const advanceAmount = Number(job.order?.advance || job.customData?.fld_b_advance || 0);
    
    if (advanceAmount > 0 && job.transactions.length === 0) {
      console.log(`Migrating job ${job.id} - Adding transaction for ${advanceAmount}`);
      
      const paymentMode = job.customData?.paymentMode || job.customData?.fld_b_payment_mode || "Cash";
      
      await prisma.transaction.create({
        data: {
          amount: advanceAmount,
          type: 'INCOME',
          date: job.date,
          category: 'JOB',
          paymentMode: paymentMode,
          description: `Advance Payment for Job #${job.jobNumber || job.id.substring(0, 8)}`,
          status: 'SETTLED',
          jobId: job.id
        }
      });
      migratedCount++;
    }
  }

  console.log(`\\nSuccessfully migrated ${migratedCount} jobs!`);
  await prisma.$disconnect();
}

migrateLegacyTransactions().catch(console.error);
