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
  console.log('Updating default system roles...\n');

  // Update USER role
  const userRole = await prisma.role.findUnique({
    where: { code: 'USER' },
  });

  if (userRole) {
    await prisma.role.update({
      where: { id: userRole.id },
      data: {
        name: 'User',
        description: 'Basic employee access for day-to-day operations',
        isSystem: true,
        permissions: JSON.stringify(defaultPermissions.USER),
      },
    });
    console.log('✓ Updated USER role');
  } else {
    await prisma.role.create({
      data: {
        name: 'User',
        code: 'USER',
        description: 'Basic employee access for day-to-day operations',
        isSystem: true,
        permissions: JSON.stringify(defaultPermissions.USER),
      },
    });
    console.log('✓ Created USER role');
  }

  // Update MANAGER role
  const managerRole = await prisma.role.findUnique({
    where: { code: 'MANAGER' },
  });

  if (managerRole) {
    await prisma.role.update({
      where: { id: managerRole.id },
      data: {
        name: 'Manager',
        description: 'Department management with approval authority',
        isSystem: true,
        permissions: JSON.stringify(defaultPermissions.MANAGER),
      },
    });
    console.log('✓ Updated MANAGER role');
  } else {
    await prisma.role.create({
      data: {
        name: 'Manager',
        code: 'MANAGER',
        description: 'Department management with approval authority',
        isSystem: true,
        permissions: JSON.stringify(defaultPermissions.MANAGER),
      },
    });
    console.log('✓ Created MANAGER role');
  }

  // Update ADMIN role - ALWAYS FULL ACCESS
  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMIN' },
  });

  if (adminRole) {
    await prisma.role.update({
      where: { id: adminRole.id },
      data: {
        name: 'Administrator',
        description: 'Full system access and configuration - Cannot be restricted',
        isSystem: true,
        permissions: JSON.stringify(defaultPermissions.ADMIN),
      },
    });
    console.log('✓ Updated ADMIN role (enforced full access)');
  } else {
    await prisma.role.create({
      data: {
        name: 'Administrator',
        code: 'ADMIN',
        description: 'Full system access and configuration - Cannot be restricted',
        isSystem: true,
        permissions: JSON.stringify(defaultPermissions.ADMIN),
      },
    });
    console.log('✓ Created ADMIN role');
  }

  console.log('\n✅ Default roles updated successfully!');
  console.log('\n📋 Role Summary:');
  console.log('  USER     - Basic employee access');
  console.log('  MANAGER  - Department management + approvals');
  console.log('  ADMIN    - Full system access (cannot be restricted)');
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
