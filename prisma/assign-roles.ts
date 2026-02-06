import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Assigning roles to users...\n');

  // Get the ADMIN role
  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMIN' },
  });

  if (!adminRole) {
    console.error('ADMIN role not found!');
    return;
  }

  // Assign all users to ADMIN role for now
  const users = await prisma.user.findMany({
    where: { roleId: { equals: null as unknown as string } },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { roleId: adminRole.id },
    });
    console.log(`✓ Assigned ${user.email} to ADMIN role`);
  }

  console.log('\n✅ All users assigned to roles!');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
