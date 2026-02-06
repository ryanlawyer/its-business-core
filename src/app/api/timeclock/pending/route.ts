import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

/**
 * GET /api/timeclock/pending
 * Get pending approval entries for assigned departments
 */
export async function GET(req: NextRequest) {
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
    const canViewAll = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewAllEntries');

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to view pending approvals' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    // Get manager's assigned departments (if not admin)
    let assignedDeptIds: string[] = [];
    if (!canViewAll) {
      const assignments = await prisma.managerAssignment.findMany({
        where: { userId: session.user.id },
        select: { departmentId: true },
      });
      assignedDeptIds = assignments.map((a) => a.departmentId);

      if (assignedDeptIds.length === 0) {
        return NextResponse.json(
          { error: 'You have no department assignments' },
          { status: 403 }
        );
      }
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      status: 'pending',
      clockOut: { not: null }, // Exclude active entries
    };

    // Department filter
    if (departmentId) {
      // If specific department requested, verify access
      if (!canViewAll && !assignedDeptIds.includes(departmentId)) {
        return NextResponse.json(
          { error: 'You do not have access to this department' },
          { status: 403 }
        );
      }
      whereClause.user = {
        departmentId: departmentId,
      };
    } else if (!canViewAll) {
      // Managers only see their assigned departments
      whereClause.user = {
        departmentId: { in: assignedDeptIds },
      };
    }

    // Period filter
    if (periodStart) {
      whereClause.clockIn = {
        ...whereClause.clockIn,
        gte: new Date(periodStart),
      };
    }
    if (periodEnd) {
      whereClause.clockIn = {
        ...whereClause.clockIn,
        lte: new Date(periodEnd),
      };
    }

    // Fetch pending entries
    const entries = await prisma.timeclockEntry.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        clockIn: 'asc', // Oldest first
      },
    });

    // Get total count (for pagination info)
    const totalCount = entries.length;

    // Get accessible departments for filter dropdown
    let departments;
    if (canViewAll) {
      departments = await prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    } else {
      departments = await prisma.department.findMany({
        where: { id: { in: assignedDeptIds } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    }

    // Fetch missed punch entries with same department scoping
    const { getMissedPunchEntries } = await import('@/lib/timeclock-rules');
    const missedPunches = await getMissedPunchEntries(
      canViewAll ? undefined : assignedDeptIds
    );

    return NextResponse.json({
      entries,
      totalCount,
      departments,
      missedPunches,
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}
