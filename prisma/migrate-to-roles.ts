import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultPermissions = {
  USER: {
    timeclock: {
      canClockInOut: true,
      canViewOwnEntries: true,
    },
    purchaseOrders: {
      canCreate: true,
      canViewOwn: true,
      canViewDepartment: false,
      canViewAll: false,
      canEdit: false,
      canApprove: false,
      canDelete: false,
    },
    budgetItems: {
      canView: true,
      canManage: false,
    },
    vendors: {
      canView: true,
      canManage: false,
    },
    users: {
      canManage: false,
    },
    departments: {
      canManage: false,
    },
    roles: {
      canManage: false,
    },
  },
  MANAGER: {
    timeclock: {
      canClockInOut: true,
      canViewOwnEntries: true,
    },
    purchaseOrders: {
      canCreate: true,
      canViewOwn: true,
      canViewDepartment: true,
      canViewAll: false,
      canEdit: true,
      canApprove: true,
      canDelete: false,
    },
    budgetItems: {
      canView: true,
      canManage: true,
    },
    vendors: {
      canView: true,
      canManage: true,
    },
    users: {
      canManage: false,
    },
    departments: {
      canManage: false,
    },
    roles: {
      canManage: false,
    },
  },
  ADMIN: {
    timeclock: {
      canClockInOut: true,
      canViewOwnEntries: true,
    },
    purchaseOrders: {
      canCreate: true,
      canViewOwn: true,
      canViewDepartment: true,
      canViewAll: true,
      canEdit: true,
      canApprove: true,
      canDelete: true,
    },
    budgetItems: {
      canView: true,
      canManage: true,
    },
    vendors: {
      canView: true,
      canManage: true,
    },
    users: {
      canManage: true,
    },
    departments: {
      canManage: true,
    },
    roles: {
      canManage: true,
    },
  },
};

async function main() {
  console.log('Starting migration to role-based system...\n');

  // Create default roles
  console.log('Creating default roles...');

  const userRole = await prisma.role.create({
    data: {
      name: 'User',
      code: 'USER',
      description: 'Basic employee access for day-to-day operations',
      isSystem: true,
      permissions: JSON.stringify(defaultPermissions.USER),
    },
  });
  console.log('✓ Created USER role');

  const managerRole = await prisma.role.create({
    data: {
      name: 'Manager',
      code: 'MANAGER',
      description: 'Department management with approval authority',
      isSystem: true,
      permissions: JSON.stringify(defaultPermissions.MANAGER),
    },
  });
  console.log('✓ Created MANAGER role');

  const adminRole = await prisma.role.create({
    data: {
      name: 'Administrator',
      code: 'ADMIN',
      description: 'Full system access and configuration',
      isSystem: true,
      permissions: JSON.stringify(defaultPermissions.ADMIN),
    },
  });
  console.log('✓ Created ADMIN role');

  // Update existing users
  console.log('\nMigrating existing users...');

  const users = await prisma.$queryRaw<any[]>`SELECT id, email, role FROM users`;

  for (const user of users) {
    let roleId: string;

    switch (user.role) {
      case 'ADMIN':
        roleId = adminRole.id;
        break;
      case 'MANAGER':
        roleId = managerRole.id;
        break;
      default:
        roleId = userRole.id;
    }

    await prisma.$executeRaw`UPDATE users SET roleId = ${roleId} WHERE id = ${user.id}`;
    console.log(`✓ Migrated user ${user.email} to role ${user.role}`);
  }

  console.log('\n✅ Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
