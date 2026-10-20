import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'test@example.com';
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, status: 'ACTIVE' },
    create: {
      email,
      password: hashedPassword,
      name: 'E2E Tester',
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });
  console.log('✅ Test user seeded successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
