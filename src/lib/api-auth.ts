import { auth } from '@/auth';
import { getPermissionsFromSession, hasPermission, UserPermissions } from '@/lib/check-permissions';

export async function requirePermission(
  section: keyof Omit<UserPermissions, '_isAdmin'>,
  permission: string
): Promise<
  | { error: string; status: number }
  | { session: any; permissions: UserPermissions; isAdmin: boolean }
> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const perms = getPermissionsFromSession(session);
  if (!perms) {
    return { error: 'Forbidden', status: 403 };
  }

  if (!hasPermission(perms.permissions, section, permission)) {
    return { error: 'Forbidden', status: 403 };
  }

  return { session, permissions: perms.permissions, isAdmin: perms.isAdmin };
}

export function isAuthError(result: any): result is { error: string; status: number } {
  return 'error' in result;
}
