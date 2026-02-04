import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

/**
 * GET /api/timeclock/team
 * Get timeclock entries for team members in assigned departments
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

    const canViewTeam = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canViewTeamEntries'
    );

    const canViewAll = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canViewAllEntries'
    );

    if (!canViewTeam && !canViewAll) {
      return NextResponse.json(
        { error: 'You do not have permission to view team entries' },
        { status: 403 }
      );
    }

    // Get manager's assigned departments (unless they can view all)
    let assignedDepartmentIds: string[] = [];

    if (!canViewAll) {
      const assignments = await prisma.managerAssignment.findMany({
        where: { userId: session.user.id },
        select: { departmentId: true },
      });

      assignedDepartmentIds = assignments.map((a) => a.departmentId);

      if (assignedDepartmentIds.length === 0) {
        return NextResponse.json(
          { error: 'You have no department assignments' },
          { status: 403 }
        );
      }
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    // Build where clause
    type WhereClause = {
      user?: {
        departmentId?: { in: string[] } | string;
      };
      userId?: string;
      status?: string;
      clockIn?: {
        gte?: Date;
        lte?: Date;
      };
    };

    const whereClause: WhereClause = {};

    // Filter by department (user's department, not the entry's)
    if (canViewAll) {
      // Admin can view all, but can still filter by department if specified
      if (departmentId) {
        whereClause.user = { departmentId };
      }
    } else {
      // Manager can only view assigned departments
      if (departmentId) {
        // Verify the requested department is in their assignments
        if (!assignedDepartmentIds.includes(departmentId)) {
          return NextResponse.json(
            { error: 'You are not assigned to this department' },
            { status: 403 }
          );
        }
        whereClause.user = { departmentId };
      } else {
        whereClause.user = { departmentId: { in: assignedDepartmentIds } };
      }
    }

    // Filter by specific user
    if (userId) {
      whereClause.userId = userId;
    }

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Filter by date range
    if (periodStart || periodEnd) {
      whereClause.clockIn = {};
      if (periodStart) {
        whereClause.clockIn.gte = new Date(periodStart);
      }
      if (periodEnd) {
        whereClause.clockIn.lte = new Date(periodEnd);
      }
    }

    // Fetch entries with user info
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
      orderBy: [
        { clockIn: 'desc' },
      ],
    });

    // Calculate period totals per employee
    const employeeTotals: Record<string, {
      userId: string;
      userName: string;
      userEmail: string;
      departmentId: string | null;
      departmentName: string | null;
      totalMinutes: number;
      regularMinutes: number;
      overtimeMinutes: number;
      entryCount: number;
      pendingCount: number;
      approvedCount: number;
      rejectedCount: number;
    }> = {};

    for (const entry of entries) {
      const userId = entry.userId;

      if (!employeeTotals[userId]) {
        employeeTotals[userId] = {
          userId: entry.user.id,
          userName: entry.user.name,
          userEmail: entry.user.email,
          departmentId: entry.user.department?.id || null,
          departmentName: entry.user.department?.name || null,
          totalMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          entryCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
        };
      }

      // Calculate minutes (duration is in seconds)
      const minutes = entry.duration ? Math.round(entry.duration / 60) : 0;
      employeeTotals[userId].totalMinutes += minutes;
      employeeTotals[userId].entryCount += 1;

      // Count by status
      if (entry.status === 'pending') {
        employeeTotals[userId].pendingCount += 1;
      } else if (entry.status === 'approved') {
        employeeTotals[userId].approvedCount += 1;
      } else if (entry.status === 'rejected') {
        employeeTotals[userId].rejectedCount += 1;
      }
    }

    // For now, regular = total (OT calculation will be added in TC-011)
    for (const userId in employeeTotals) {
      employeeTotals[userId].regularMinutes = employeeTotals[userId].totalMinutes;
      employeeTotals[userId].overtimeMinutes = 0;
    }

    // Get list of departments the manager can access
    let accessibleDepartments: { id: string; name: string }[] = [];
    if (canViewAll) {
      accessibleDepartments = await prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    } else {
      accessibleDepartments = await prisma.department.findMany({
        where: {
          id: { in: assignedDepartmentIds },
          isActive: true,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({
      entries,
      employeeTotals: Object.values(employeeTotals),
      accessibleDepartments,
      totalEntries: entries.length,
    });
  } catch (error) {
    console.error('Error fetching team entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team entries' },
      { status: 500 }
    );
  }
}
