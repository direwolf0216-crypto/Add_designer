import prisma from '../../src/lib/prisma';

async function main() {
  const layouts = await prisma.formLayout.findMany();
  for (const layout of layouts) {
    if (typeof layout.schema === 'string') {
      try {
        const parsed = JSON.parse(layout.schema);
        await prisma.formLayout.update({
          where: { id: layout.id },
          data: { schema: parsed }
        });
        console.log(`Fixed schema for layout: ${layout.formKey}`);
      } catch (e) {
        console.log(`Failed to parse schema for layout: ${layout.formKey}`);
      }
    } else {
        console.log(`Schema is already an object for layout: ${layout.formKey}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
