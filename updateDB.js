const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateDB() {
  const layouts = await prisma.formLayout.findMany({
    where: { formKey: 'JOB_FORM' }
  });

  for (const layout of layouts) {
    let schemaStr = JSON.stringify(layout.schema);
    
    // Replace labels
    schemaStr = schemaStr.replace(/Album Designer/g, "Print Designer");
    schemaStr = schemaStr.replace(/Album Details/g, "Print Details");
    schemaStr = schemaStr.replace(/Album Type/g, "Print Type");
    schemaStr = schemaStr.replace(/Album Status/g, "Print Status");
    schemaStr = schemaStr.replace(/Shoot Status/g, "Job Status");
    schemaStr = schemaStr.replace(/Shoot Date/g, "Job Date");
    schemaStr = schemaStr.replace(/Shoot Time/g, "Job Time");
    schemaStr = schemaStr.replace(/Shoot Location/g, "Job Location");
    schemaStr = schemaStr.replace(/Shoot Category/g, "Job Category");

    const newSchema = JSON.parse(schemaStr);

    await prisma.formLayout.update({
      where: { id: layout.id },
      data: { 
        name: "Job Form", // Update name from Job Form / Printing Job Form
        schema: newSchema 
      }
    });
    console.log(`Updated form layout: ${layout.name} -> Job Form`);
  }
}

updateDB()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
