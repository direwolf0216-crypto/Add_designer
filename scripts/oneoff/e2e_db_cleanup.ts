import prisma from '../../src/lib/prisma';

async function main() {
  console.log('Starting cleanup of LOAD-TEST dummy jobs...');
  
  const result = await prisma.job.deleteMany({
    where: {
      jobNumber: {
        startsWith: 'LOAD-TEST-'
      }
    }
  });

  console.log(`✅ Successfully deleted ${result.count} dummy jobs from the database.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
