import prisma from '../../src/lib/prisma';

async function main() {
  const layout = await prisma.formLayout.findUnique({
    where: { formKey: "JOB_FORM" }
  });

  if (layout && typeof layout.schema === 'object' && layout.schema !== null) {
    let schema: any = layout.schema;
    const secIndex = schema.sections.findIndex((s: any) => s.id === 'sec_job_details');
    if (secIndex >= 0) {
      schema.sections[secIndex].fields = schema.sections[secIndex].fields.filter(
        (f: any) => !(f.name.toLowerCase().includes('rate') || f.name.toLowerCase().includes('price') || f.name.toLowerCase().includes('amount'))
      );
      
      await prisma.formLayout.update({
        where: { formKey: "JOB_FORM" },
        data: { schema: schema }
      });
      console.log('Successfully removed RATE field from JOB_FORM layout.');
    }
  } else {
    console.log('Layout not found or invalid schema type.');
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
