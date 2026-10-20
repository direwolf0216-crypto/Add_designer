import prisma from '../lib/prisma';
import { DEFAULT_LAYOUTS } from '../lib/defaultLayouts';

async function main() {
  // No layouts to patch currently
}

main().catch(console.error).finally(() => prisma.$disconnect());
