/**
 * @deprecated This file contains the legacy hardcoded permission system.
 *
 * The application now uses database-driven permissions from the Role model.
 * See:
 * - src/lib/check-permissions.ts (server-side permission utilities)
 * - src/lib/client-permissions.ts (client-side permission utilities)
 *
 * Only the display helper functions (getRoleDisplay, getRoleBadgeColor)
 * are still in use for UI purposes.
 */

export type UserRole = 'USER' | 'MANAGER' | 'ADMIN';

/**
 * @deprecated Use database permissions instead
 * See src/lib/check-permissions.ts
 */
export const permissions = {
  canClockInOut: (role: UserRole) => true,
  canViewOwnPOs: (role: UserRole) => true,
  canViewDepartmentPOs: (role: UserRole) => ['MANAGER', 'ADMIN'].includes(role),
  canViewAllPOs: (role: UserRole) => role === 'ADMIN',
  canCreatePO: (role: UserRole) => true,
  canEditPO: (role: UserRole) => ['MANAGER', 'ADMIN'].includes(role),
  canApprovePO: (role: UserRole) => ['MANAGER', 'ADMIN'].includes(role),
  canDeletePO: (role: UserRole) => role === 'ADMIN',
  canViewBudgetItems: (role: UserRole) => true,
  canManageBudgetItems: (role: UserRole) => ['MANAGER', 'ADMIN'].includes(role),
  canViewVendors: (role: UserRole) => true,
  canManageVendors: (role: UserRole) => ['MANAGER', 'ADMIN'].includes(role),
  canManageUsers: (role: UserRole) => role === 'ADMIN',
  canManageDepartments: (role: UserRole) => role === 'ADMIN',
};

/**
 * @deprecated Use database permissions instead
 * See src/lib/check-permissions.ts
 */
export function canViewPO(
  userRole: UserRole,
  userDepartmentId: string | null,
  poCreatorId: string,
  poDepartment: string | null,
  currentUserId: string
): boolean {
  if (userRole === 'ADMIN') return true;
  if (userRole === 'MANAGER' && userDepartmentId && poDepartment === userDepartmentId) {
    return true;
  }
  return poCreatorId === currentUserId;
}

/**
 * @deprecated Use database permissions instead
 * See src/lib/check-permissions.ts
 */
export function canEditPO(
  userRole: UserRole,
  poStatus: string,
  poCreatorId: string,
  currentUserId: string
): boolean {
  if (userRole === 'ADMIN') return true;
  if (userRole === 'MANAGER') return true;
  if (userRole === 'USER' && poStatus === 'DRAFT' && poCreatorId === currentUserId) {
    return true;
  }
  return false;
}

/**
 * Get role display name
 */
export function getRoleDisplay(role: UserRole): string {
  const displays: Record<UserRole, string> = {
    USER: 'User',
    MANAGER: 'Manager',
    ADMIN: 'Administrator',
  };
  return displays[role];
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    USER: 'bg-gray-100 text-gray-800',
    MANAGER: 'bg-blue-100 text-blue-800',
    ADMIN: 'bg-purple-100 text-purple-800',
  };
  return colors[role];
}
