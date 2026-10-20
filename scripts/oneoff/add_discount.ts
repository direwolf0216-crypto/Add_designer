import prisma from '../../src/lib/prisma';

async function main() {
  const layout = await prisma.formLayout.findUnique({
    where: { formKey: "JOB_FORM" }
  });

  if (layout) {
    let schema: any = layout.schema;
    if (typeof schema === 'string') {
      schema = JSON.parse(schema);
    }
    
    let updated = false;
    const finSection = schema.sections.find((s: any) => s.id === 'sec_job_financial');
    if (finSection) {
      if (!finSection.fields.find((f: any) => f.name.toLowerCase() === 'discount')) {
        finSection.fields.push({
          id: 'fld_b_discount',
          name: 'Discount',
          type: 'CURRENCY',
          mandatory: false
        });
        updated = true;
      }
    }

    if (updated) {
      await prisma.formLayout.update({
        where: { formKey: "JOB_FORM" },
        data: { schema: JSON.stringify(schema) }
      });
      console.log("Database successfully updated with Discount field!");
    } else {
      console.log("Discount field already exists.");
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
