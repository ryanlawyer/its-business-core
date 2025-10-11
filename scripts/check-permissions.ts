import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, code: true, permissions: true },
  });

  console.log('\n=== Current Role Permissions ===\n');

  for (const role of roles) {
    console.log(`Role: ${role.name} (${role.code})`);
    console.log('Permissions:', JSON.stringify(JSON.parse(role.permissions), null, 2));
    console.log('\n---\n');
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: { select: { name: true, code: true } } },
  });

  console.log('=== Users and Their Roles ===\n');
  for (const user of users) {
    console.log(`${user.name} (${user.email}) - Role: ${user.role.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
