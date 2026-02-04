import { prisma } from '@/lib/prisma';

export type UserPermissions = {
  _isAdmin?: boolean;
  timeclock?: {
    canClockInOut?: boolean;
    canViewOwnEntries?: boolean;
    canManageConfig?: boolean;
    canAssignManagers?: boolean;
  };
  purchaseOrders?: {
    canCreate?: boolean;
    canViewOwn?: boolean;
    canViewDepartment?: boolean;
    canViewAll?: boolean;
    canEdit?: boolean;
    canApprove?: boolean;
    canDelete?: boolean;
    canVoid?: boolean;
  };
  budgetItems?: {
    canView?: boolean;
    canManage?: boolean;
    canCreateAmendments?: boolean;
    canTransferFunds?: boolean;
    canViewAllCategories?: boolean;
    canManageCategories?: boolean;
    canCloseFiscalYear?: boolean;
    canAccessClosedYears?: boolean;
    canExportReports?: boolean;
  };
  vendors?: {
    canView?: boolean;
    canManage?: boolean;
  };
  users?: {
    canManage?: boolean;
  };
  departments?: {
    canView?: boolean;
    canManage?: boolean;
    canViewAll?: boolean;
  };
  roles?: {
    canManage?: boolean;
  };
  auditLog?: {
    canView?: boolean;
    canViewAll?: boolean;
    canExport?: boolean;
  };
  settings?: {
    canManage?: boolean;
  };
  receipts?: {
    canUpload?: boolean;
    canViewOwn?: boolean;
    canViewAll?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canProcess?: boolean;
    canExport?: boolean;
  };
  bankStatements?: {
    canUpload?: boolean;
    canViewOwn?: boolean;
    canViewAll?: boolean;
    canDelete?: boolean;
    canMatch?: boolean;
  };
};

/**
 * Get user with their role and permissions from database
 * @deprecated Use getPermissionsFromSession when session is available
 */
export async function getUserWithPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      department: true,
    },
  });

  if (!user?.role) {
    return null;
  }

  const permissions: UserPermissions = JSON.parse(user.role.permissions);

  return {
    user,
    permissions,
    isAdmin: permissions._isAdmin === true,
  };
}

/**
 * Get permissions from session (avoids database query)
 * Faster alternative to getUserWithPermissions
 */
export function getPermissionsFromSession(session: any): {
  permissions: UserPermissions;
  isAdmin: boolean;
} | null {
  if (!session?.user?.permissions) {
    return null;
  }

  const permissions: UserPermissions = JSON.parse(session.user.permissions);

  return {
    permissions,
    isAdmin: permissions._isAdmin === true,
  };
}

/**
 * Check if user has a specific permission
 * Returns true if user is admin or has the specific permission
 */
export function hasPermission(
  permissions: UserPermissions,
  section: keyof Omit<UserPermissions, '_isAdmin'>,
  permission: string
): boolean {
  // Admin override
  if (permissions._isAdmin === true) {
    return true;
  }

  const sectionPermissions = permissions[section] as Record<string, boolean> | undefined;
  return sectionPermissions?.[permission] === true;
}

/**
 * Check if user can view their own department's data
 */
export function canViewDepartmentData(
  permissions: UserPermissions,
  section: 'purchaseOrders' | 'auditLog'
): boolean {
  if (permissions._isAdmin === true) {
    return true;
  }

  if (section === 'purchaseOrders') {
    return permissions.purchaseOrders?.canViewDepartment === true;
  }

  return false;
}

/**
 * Check if user can view all data across departments
 */
export function canViewAllData(
  permissions: UserPermissions,
  section: 'purchaseOrders' | 'departments' | 'auditLog'
): boolean {
  if (permissions._isAdmin === true) {
    return true;
  }

  if (section === 'purchaseOrders') {
    return permissions.purchaseOrders?.canViewAll === true;
  }

  if (section === 'departments') {
    return permissions.departments?.canViewAll === true;
  }

  if (section === 'auditLog') {
    return permissions.auditLog?.canViewAll === true;
  }

  return false;
}
