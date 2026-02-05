import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSetupComplete, markSetupComplete, setSystemConfig } from '@/lib/setup-status';
import { updateSettings, getDefaultSettings } from '@/lib/settings';
import { clearSetupCache } from '@/middleware';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface SetupData {
  admin: {
    email: string;
    password: string;
    name: string;
  };
  organization: {
    name?: string;
    organizationName?: string; // Frontend uses this field name
    logo?: string;
    departmentName: string;
    timezone: string;
    fiscalYearStartMonth: number;
  };
  integrations?: {
    anthropicApiKey?: string;
    emailProvider?: 'gmail' | 'office365' | 'smtp' | 'none';
    emailConfig?: Record<string, string>;
  };
}

function validateSetupData(data: SetupData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.admin?.email) errors.push('Admin email is required');
  if (!data.admin?.password) errors.push('Admin password is required');
  if (!data.admin?.name) errors.push('Admin name is required');
  // Accept either 'name' or 'organizationName' from frontend
  const orgName = data.organization?.name || data.organization?.organizationName;
  if (!orgName) errors.push('Organization name is required');
  if (!data.organization?.departmentName) errors.push('Department name is required');

  if (data.admin?.password && data.admin.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (data.admin?.email && !data.admin.email.includes('@')) {
    errors.push('Invalid email format');
  }

  return { valid: errors.length === 0, errors };
}

export async function POST(req: NextRequest) {
  try {
    // Prevent setup if already complete
    if (await isSetupComplete()) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 }
      );
    }

    const data: SetupData = await req.json();

    // Validate input
    const validation = validateSetupData(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create default roles if they don't exist
    const adminRole = await prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        name: 'Administrator',
        code: 'ADMIN',
        description: 'Full system access and configuration',
        isSystem: true,
        permissions: JSON.stringify({
          _isAdmin: true,
          timeclock: {
            canClockInOut: true,
            canViewOwnEntries: true,
            canViewTeamEntries: true,
            canEditTeamEntries: true,
            canApproveEntries: true,
            canExportPayroll: true,
            canViewAllEntries: true,
            canManageConfig: true,
            canManageExportTemplates: true,
            canAssignManagers: true,
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
          vendors: { canView: true, canManage: true },
          users: { canManage: true },
          departments: { canView: true, canManage: true, canViewAll: true },
          roles: { canManage: true },
          auditLog: { canView: true, canViewAll: true, canExport: true },
          settings: { canManage: true },
        }),
      },
    });

    // Create Manager and User roles (use the full permission objects from the plan)
    await prisma.role.upsert({
      where: { code: 'MANAGER' },
      update: {},
      create: {
        name: 'Manager',
        code: 'MANAGER',
        description: 'Department management with approval authority',
        isSystem: true,
        permissions: JSON.stringify({
          timeclock: {
            canClockInOut: true,
            canViewOwnEntries: true,
            canViewTeamEntries: true,
            canEditTeamEntries: true,
            canApproveEntries: true,
            canExportPayroll: true,
            canViewAllEntries: false,
            canManageConfig: false,
            canManageExportTemplates: false,
            canAssignManagers: false,
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
          vendors: { canView: true, canManage: true },
          users: { canManage: false },
          departments: { canView: true, canManage: false, canViewAll: true },
          roles: { canManage: false },
          auditLog: { canView: true, canViewAll: false, canExport: true },
          settings: { canManage: false },
        }),
      },
    });

    await prisma.role.upsert({
      where: { code: 'USER' },
      update: {},
      create: {
        name: 'User',
        code: 'USER',
        description: 'Basic employee access for day-to-day operations',
        isSystem: true,
        permissions: JSON.stringify({
          timeclock: {
            canClockInOut: true,
            canViewOwnEntries: true,
            canViewTeamEntries: false,
            canEditTeamEntries: false,
            canApproveEntries: false,
            canExportPayroll: false,
            canViewAllEntries: false,
            canManageConfig: false,
            canManageExportTemplates: false,
            canAssignManagers: false,
          },
          purchaseOrders: {
            canCreate: true,
            canViewOwn: true,
            canViewDepartment: false,
            canViewAll: false,
            canEdit: false,
            canApprove: false,
            canDelete: false,
            canVoid: false,
            canUploadReceipts: false,
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
          vendors: { canView: true, canManage: false },
          users: { canManage: false },
          departments: { canView: false, canManage: false, canViewAll: false },
          roles: { canManage: false },
          auditLog: { canView: false, canViewAll: false, canExport: false },
          settings: { canManage: false },
        }),
      },
    });

    // Create department
    const department = await prisma.department.create({
      data: {
        name: data.organization.departmentName,
        description: 'Initial department',
      },
    });

    // Create admin user
    const hashedPassword = await bcrypt.hash(data.admin.password, 10);
    await prisma.user.create({
      data: {
        email: data.admin.email,
        password: hashedPassword,
        name: data.admin.name,
        roleId: adminRole.id,
        departmentId: department.id,
        authProvider: 'local',
      },
    });

    // Update system settings
    const settings = getDefaultSettings();
    // Accept either 'name' or 'organizationName' from frontend
    settings.organization.name = data.organization.name || data.organization.organizationName || '';
    settings.organization.logo = data.organization.logo || null;
    settings.fiscalYear.startMonth = data.organization.fiscalYearStartMonth || 1;

    // Set up integrations if provided
    if (data.integrations?.anthropicApiKey) {
      settings.ai.provider = 'anthropic';
      settings.ai.anthropic.apiKey = data.integrations.anthropicApiKey;
    }

    if (data.integrations?.emailProvider && data.integrations.emailProvider !== 'none') {
      settings.email.provider = data.integrations.emailProvider;
      if (data.integrations.emailConfig) {
        const config = data.integrations.emailConfig;
        switch (data.integrations.emailProvider) {
          case 'smtp':
            settings.email.smtp = {
              host: config.host || '',
              port: parseInt(config.port || '587'),
              secure: config.secure === 'true',
              username: config.username || '',
              password: config.password || '',
              fromAddress: config.fromAddress || '',
            };
            break;
          case 'gmail':
            settings.email.gmail = {
              clientId: config.clientId || '',
              clientSecret: config.clientSecret || '',
              refreshToken: config.refreshToken || '',
            };
            break;
          case 'office365':
            settings.email.office365 = {
              clientId: config.clientId || '',
              clientSecret: config.clientSecret || '',
              tenantId: config.tenantId || '',
              refreshToken: config.refreshToken || '',
            };
            break;
        }
      }
    }

    updateSettings(settings);

    // Store timezone
    await setSystemConfig('timezone', data.organization.timezone || 'UTC');

    // Store detected NEXTAUTH_URL if not already set
    const host = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    if (host) {
      await setSystemConfig('nextauth_url', `${protocol}://${host}`);
    }

    // Generate NEXTAUTH_SECRET if not provided via env
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'change-this-to-a-random-secret-in-production') {
      const secret = crypto.randomBytes(32).toString('base64');
      await setSystemConfig('nextauth_secret', secret);
    }

    // Mark setup as complete
    await markSetupComplete();

    // Clear the middleware cache so subsequent requests see the new state
    clearSetupCache();

    return NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: String(error) },
      { status: 500 }
    );
  }
}
