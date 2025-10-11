import { UserPermissions } from './check-permissions';

/**
 * Parse permissions from session (client-side)
 */
export function parsePermissions(permissionsJson: string | undefined): UserPermissions {
  if (!permissionsJson) return {};
  try {
    return JSON.parse(permissionsJson);
  } catch {
    return {};
  }
}

/**
 * Check if user has a specific permission (client-side)
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
 * Check if user is admin (client-side)
 */
export function isAdmin(permissions: UserPermissions): boolean {
  return permissions._isAdmin === true;
}
