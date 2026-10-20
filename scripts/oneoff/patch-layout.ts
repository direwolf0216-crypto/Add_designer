import prisma from '../../src/lib/prisma';
import { DEFAULT_LAYOUTS } from '../../src/lib/defaultLayouts';

async function main() {
  // No layouts to patch currently
}

main().catch(console.error).finally(() => prisma.$disconnect());
