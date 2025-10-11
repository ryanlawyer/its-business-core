import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

/**
 * GET /api/permissions/check?resource=purchaseOrders&permission=canUploadReceipts
 * Check if the current user has a specific permission
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ hasPermission: false }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource');
    const permission = searchParams.get('permission');

    if (!resource || !permission) {
      return NextResponse.json(
        { error: 'Resource and permission are required' },
        { status: 400 }
      );
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const hasPerms = hasPermission(
      userWithPerms.permissions,
      resource,
      permission
    );

    return NextResponse.json({ hasPermission: hasPerms });
  } catch (error) {
    console.error('Error checking permission:', error);
    return NextResponse.json(
      { error: 'Failed to check permission' },
      { status: 500 }
    );
  }
}
