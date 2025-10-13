import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { recalculateAllBudgets } from '../src/lib/budget-tracking';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.timeclockEntry.deleteMany();
  await prisma.pOLineItem.deleteMany();
  await prisma.document.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.role.deleteMany();
  await prisma.systemSettings.deleteMany();

  // ============================================
  // CREATE ROLES
  // ============================================
  console.log('Creating roles...');

  const adminRole = await prisma.role.create({
    data: {
      name: 'Administrator',
      code: 'ADMIN',
      description: 'Full system access and configuration',
      isSystem: true,
      permissions: JSON.stringify({
        _isAdmin: true, // Special flag for admin override
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
          canVoid: true,
          canUploadReceipts: true,
        },
        budgetItems: {
          canView: true,
          canManage: true,
          canCreateAmendments: true,
          canTransferFunds: true,
          canViewAllCategories: true,
          canManageCategories: true,
          canCloseFiscalYear: true,
          canAccessClosedYears: true,
          canExportReports: true,
        },
        vendors: {
          canView: true,
          canManage: true,
        },
        users: {
          canManage: true,
        },
        departments: {
          canView: true,
          canManage: true,
          canViewAll: true,
        },
        roles: {
          canManage: true,
        },
        auditLog: {
          canView: true,
          canViewAll: true,
          canExport: true,
        },
        settings: {
          canManage: true,
        },
      }),
    },
  });

  const managerRole = await prisma.role.create({
    data: {
      name: 'Manager',
      code: 'MANAGER',
      description: 'Department management with approval authority',
      isSystem: true,
      permissions: JSON.stringify({
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
          canVoid: true,
          canUploadReceipts: true,
        },
        budgetItems: {
          canView: true,
          canManage: true,
          canCreateAmendments: true,
          canTransferFunds: true,
          canViewAllCategories: true,
          canManageCategories: false,
          canCloseFiscalYear: false,
          canAccessClosedYears: false,
          canExportReports: true,
        },
        vendors: {
          canView: true,
          canManage: true,
        },
        users: {
          canManage: false,
        },
        departments: {
          canView: true,
          canManage: false,
          canViewAll: true,
        },
        roles: {
          canManage: false,
        },
        auditLog: {
          canView: true,
          canViewAll: false, // Department only
          canExport: true,
        },
        settings: {
          canManage: false,
        },
      }),
    },
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'User',
      code: 'USER',
      description: 'Basic employee access for day-to-day operations',
      isSystem: true,
      permissions: JSON.stringify({
        timeclock: {
          canClockInOut: true,
          canViewOwnEntries: true,
        },
        purchaseOrders: {
          canCreate: true,
          canViewOwn: true,
          canViewDepartment: false,
          canViewAll: false,
          canEdit: false, // Can only edit own DRAFT (enforced in code)
          canApprove: false,
          canDelete: false,
          canVoid: false,
          canUploadReceipts: false, // Disabled by default for users
        },
        budgetItems: {
          canView: true,
          canManage: false,
          canCreateAmendments: false,
          canTransferFunds: false,
          canViewAllCategories: false,
          canManageCategories: false,
          canCloseFiscalYear: false,
          canAccessClosedYears: false,
          canExportReports: false,
        },
        vendors: {
          canView: true,
          canManage: false,
        },
        users: {
          canManage: false,
        },
        departments: {
          canView: false,
          canManage: false,
          canViewAll: false,
        },
        roles: {
          canManage: false,
        },
        auditLog: {
          canView: false,
          canViewAll: false,
          canExport: false,
        },
        settings: {
          canManage: false,
        },
      }),
    },
  });

  // ============================================
  // CREATE DEPARTMENTS
  // ============================================
  console.log('Creating departments...');
  const adminDept = await prisma.department.create({
    data: {
      name: 'Administration',
      description: 'Administrative services',
    },
  });

  const itDept = await prisma.department.create({
    data: {
      name: 'IT',
      description: 'Information Technology',
    },
  });

  const financeDept = await prisma.department.create({
    data: {
      name: 'Finance',
      description: 'Finance and Accounting',
    },
  });

  // ============================================
  // CREATE USERS
  // ============================================
  console.log('Creating users...');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      roleId: adminRole.id,
      departmentId: adminDept.id,
      authProvider: 'local',
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@example.com',
      password: await bcrypt.hash('manager123', 10),
      name: 'Department Manager',
      roleId: managerRole.id,
      departmentId: itDept.id,
      authProvider: 'local',
    },
  });

  const regularUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      password: await bcrypt.hash('user123', 10),
      name: 'Regular User',
      roleId: userRole.id,
      departmentId: financeDept.id,
      authProvider: 'local',
    },
  });

  // ============================================
  // CREATE BUDGET ITEMS
  // ============================================
  console.log('Creating budget items...');
  const budgetItems = await Promise.all([
    prisma.budgetItem.create({
      data: {
        code: 'ADMIN-001',
        description: 'Office Supplies',
        budgetAmount: 5000,
        departmentId: adminDept.id,
        fiscalYear: 2025,
      },
    }),
    prisma.budgetItem.create({
      data: {
        code: 'IT-001',
        description: 'Hardware & Equipment',
        budgetAmount: 25000,
        departmentId: itDept.id,
        fiscalYear: 2025,
      },
    }),
    prisma.budgetItem.create({
      data: {
        code: 'IT-002',
        description: 'Software Licenses',
        budgetAmount: 15000,
        departmentId: itDept.id,
        fiscalYear: 2025,
      },
    }),
    prisma.budgetItem.create({
      data: {
        code: 'FIN-001',
        description: 'Professional Services',
        budgetAmount: 10000,
        departmentId: financeDept.id,
        fiscalYear: 2025,
      },
    }),
  ]);

  // ============================================
  // CREATE VENDORS
  // ============================================
  console.log('Creating vendors...');
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        vendorNumber: 'V001',
        name: 'Office Depot',
        phone: '555-0100',
        email: 'sales@officedepot.com',
        address: '123 Business St',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
      },
    }),
    prisma.vendor.create({
      data: {
        vendorNumber: 'V002',
        name: 'Dell Technologies',
        phone: '555-0200',
        email: 'sales@dell.com',
        address: '456 Tech Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
      },
    }),
    prisma.vendor.create({
      data: {
        vendorNumber: 'V003',
        name: 'Microsoft',
        phone: '555-0300',
        email: 'licensing@microsoft.com',
        address: '789 Software Blvd',
        city: 'Redmond',
        state: 'WA',
        zipCode: '98052',
      },
    }),
    prisma.vendor.create({
      data: {
        vendorNumber: 'V004',
        name: 'Acme Consulting',
        phone: '555-0400',
        email: 'contact@acmeconsulting.com',
        address: '321 Service Ln',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
      },
    }),
  ]);

  // ============================================
  // CREATE SAMPLE PURCHASE ORDERS
  // ============================================
  console.log('Creating purchase orders...');

  // Draft PO
  const draftPO = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2025-001',
      poDate: new Date('2025-01-15'),
      vendorId: vendors[0].id,
      requestedById: regularUser.id,
      departmentId: adminDept.id,
      notes: 'Monthly office supplies order',
      status: 'DRAFT',
      totalAmount: 450,
      lineItems: {
        create: [
          {
            description: 'Copy Paper (10 reams)',
            amount: 150,
            budgetItemId: budgetItems[0].id,
          },
          {
            description: 'Pens and Pencils',
            amount: 75,
            budgetItemId: budgetItems[0].id,
          },
          {
            description: 'File Folders',
            amount: 225,
            budgetItemId: budgetItems[0].id,
          },
        ],
      },
    },
  });

  // Pending Approval PO
  const pendingPO = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2025-002',
      poDate: new Date('2025-01-20'),
      vendorId: vendors[1].id,
      requestedById: regularUser.id,
      departmentId: itDept.id,
      notes: 'New laptops for IT department',
      status: 'PENDING_APPROVAL',
      totalAmount: 4500,
      lineItems: {
        create: [
          {
            description: 'Dell Latitude 7440 (3 units)',
            amount: 4500,
            budgetItemId: budgetItems[1].id,
          },
        ],
      },
    },
  });

  // Approved PO
  const approvedPO = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2025-003',
      poDate: new Date('2025-02-01'),
      vendorId: vendors[2].id,
      requestedById: managerUser.id,
      departmentId: itDept.id,
      notes: 'Annual Microsoft 365 licenses',
      status: 'APPROVED',
      approvedBy: adminUser.id,
      approvedAt: new Date('2025-02-02'),
      totalAmount: 3600,
      lineItems: {
        create: [
          {
            description: 'Microsoft 365 Business Standard (12 licenses)',
            amount: 3600,
            budgetItemId: budgetItems[2].id,
          },
        ],
      },
    },
  });

  // Completed PO
  const completedPO = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2025-004',
      poDate: new Date('2025-01-10'),
      vendorId: vendors[3].id,
      requestedById: adminUser.id,
      departmentId: financeDept.id,
      notes: 'Quarterly accounting consultation',
      status: 'COMPLETED',
      approvedBy: adminUser.id,
      approvedAt: new Date('2025-01-11'),
      completedAt: new Date('2025-01-25'),
      totalAmount: 2500,
      lineItems: {
        create: [
          {
            description: 'Tax preparation services',
            amount: 2500,
            budgetItemId: budgetItems[3].id,
          },
        ],
      },
    },
  });

  // ============================================
  // CREATE SAMPLE TIMECLOCK ENTRIES
  // ============================================
  console.log('Creating timeclock entries...');
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.timeclockEntry.create({
    data: {
      userId: regularUser.id,
      clockIn: new Date(yesterday.setHours(8, 0, 0, 0)),
      clockOut: new Date(yesterday.setHours(17, 0, 0, 0)),
      duration: 9 * 60 * 60, // 9 hours in seconds
    },
  });

  await prisma.timeclockEntry.create({
    data: {
      userId: managerUser.id,
      clockIn: new Date(yesterday.setHours(9, 0, 0, 0)),
      clockOut: new Date(yesterday.setHours(18, 30, 0, 0)),
      duration: 9.5 * 60 * 60, // 9.5 hours in seconds
    },
  });

  // ============================================
  // CREATE SYSTEM SETTINGS
  // ============================================
  console.log('Creating system settings...');
  await prisma.systemSettings.create({
    data: {
      key: 'max_file_upload_size_mb',
      value: '10',
      description: 'Maximum file upload size in megabytes for receipt uploads',
      category: 'file_upload',
    },
  });

  // Recalculate budget tracking for all POs
  console.log('
📊 Recalculating budget tracking...');
  const budgetResult = await recalculateAllBudgets();
  console.log(`   ✓ Updated ${budgetResult.budgetItemsUpdated} budget items`);


  console.log('✅ Seeding complete!');
  console.log('\n📋 Sample Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:   admin@example.com / admin123');
  console.log('Manager: manager@example.com / manager123');
  console.log('User:    user@example.com / user123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 Database Summary:');
  console.log(`   Roles: 3 (Admin, Manager, User)`);
  console.log(`   Departments: 3`);
  console.log(`   Users: 3`);
  console.log(`   Budget Items: 4`);
  console.log(`   Vendors: 4`);
  console.log(`   Purchase Orders: 4`);
  console.log(`   Timeclock Entries: 2\n`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
