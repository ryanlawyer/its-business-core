import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { getMissedPunchEntries } from '@/lib/timeclock-rules';

/**
 * GET /api/timeclock/missed-punches
 * Dedicated endpoint for querying missed punch entries
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canApprove = hasPermission(userWithPerms.permissions, 'timeclock', 'canApproveEntries');
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canViewAll = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewAllEntries');

    // Get department scoping for non-admin users
    let departmentIds: string[] | undefined;
    if (!canViewAll) {
      const assignments = await prisma.managerAssignment.findMany({
        where: { userId: session.user.id },
        select: { departmentId: true },
      });
      departmentIds = assignments.map((a) => a.departmentId);
    }

    const missedPunches = await getMissedPunchEntries(departmentIds);

    return NextResponse.json({ missedPunches });
  } catch (error) {
    console.error('Error fetching missed punches:', error);
    return NextResponse.json({ error: 'Failed to fetch missed punches' }, { status: 500 });
  }
}
