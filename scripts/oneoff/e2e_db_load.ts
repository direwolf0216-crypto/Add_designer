import prisma from '../../src/lib/prisma';

async function main() {
  console.log('Fetching a client to attach jobs to...');
  const client = await prisma.client.findFirst();
  if (!client) {
    console.error('No client found in DB. Please create at least one client.');
    return;
  }

  const TOTAL_JOBS = 10000;
  const BATCH_SIZE = 1000;
  
  console.log(`Starting generation of ${TOTAL_JOBS} jobs for Client ID: ${client.id}`);

  for (let i = 0; i < TOTAL_JOBS; i += BATCH_SIZE) {
    const jobsToInsert = [];
    for (let j = 0; j < BATCH_SIZE; j++) {
      const idx = i + j + 1;
      jobsToInsert.push({
        clientId: client.id,
        category: 'Wedding',
        date: new Date(),
        time: '10:00 AM',
        location: 'Virtual',
        status: idx % 3 === 0 ? 'Completed' : (idx % 2 === 0 ? 'Designing' : 'Pending'),
        jobNumber: `LOAD-TEST-${idx}`,
        customData: {
          category: 'Test Category',
          dueDate: new Date().toISOString(),
          size: '10x10',
          qty: 5,
          fld_b_package: 50000,
          fld_b_advance: 10000
        }
      });
    }

    await prisma.job.createMany({
      data: jobsToInsert
    });
    
    console.log(`Inserted batch ${i / BATCH_SIZE + 1} of ${TOTAL_JOBS / BATCH_SIZE}`);
  }

  console.log('✅ Successfully generated 10,000 jobs.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
