import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { calculateOvertime, TimeclockEntryForCalculation } from '@/lib/overtime';

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

    // Calculate overtime using the overtime service
    const overtimeConfig = await prisma.overtimeConfig.findFirst();

    // Convert entries to calculation format
    const calcEntries: TimeclockEntryForCalculation[] = entries
      .filter((e) => e.clockOut && e.duration) // Only completed entries
      .map((e) => ({
        id: e.id,
        userId: e.userId,
        clockIn: new Date(e.clockIn),
        clockOut: e.clockOut ? new Date(e.clockOut) : null,
        duration: e.duration,
        status: e.status,
      }));

    const overtimeResult = calculateOvertime(calcEntries, overtimeConfig);

    // Update employee totals with OT breakdown
    for (const userId in employeeTotals) {
      const otResult = overtimeResult.employees[userId];
      if (otResult) {
        employeeTotals[userId].regularMinutes = otResult.regularMinutes;
        employeeTotals[userId].overtimeMinutes =
          otResult.dailyOvertimeMinutes + otResult.weeklyOvertimeMinutes;
      } else {
        employeeTotals[userId].regularMinutes = employeeTotals[userId].totalMinutes;
        employeeTotals[userId].overtimeMinutes = 0;
      }
    }

    // Add OT flags to individual entries
    const entriesWithOTFlags = entries.map((entry) => {
      // Calculate if this individual entry exceeds daily threshold
      let exceedsDailyThreshold = false;
      if (
        overtimeConfig?.dailyThreshold &&
        entry.duration &&
        entry.clockOut
      ) {
        const entryMinutes = Math.floor(entry.duration / 60);
        exceedsDailyThreshold = entryMinutes > overtimeConfig.dailyThreshold;
      }

      // Check if employee has any overtime
      const employeeOT = overtimeResult.employees[entry.userId];
      const hasOvertime =
        employeeOT &&
        (employeeOT.dailyOvertimeMinutes > 0 || employeeOT.weeklyOvertimeMinutes > 0);

      return {
        ...entry,
        otFlags: {
          exceedsDailyThreshold,
          hasEmployeeOvertime: hasOvertime,
          dailyOvertimeMinutes: employeeOT?.dailyOvertimeMinutes || 0,
          weeklyOvertimeMinutes: employeeOT?.weeklyOvertimeMinutes || 0,
        },
      };
    });

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

    // Add hasOvertime flag to employee totals
    const employeeTotalsWithFlags = Object.values(employeeTotals).map((emp) => ({
      ...emp,
      hasOvertime: emp.overtimeMinutes > 0,
      dailyOvertimeMinutes: overtimeResult.employees[emp.userId]?.dailyOvertimeMinutes || 0,
      weeklyOvertimeMinutes: overtimeResult.employees[emp.userId]?.weeklyOvertimeMinutes || 0,
    }));

    return NextResponse.json({
      entries: entriesWithOTFlags,
      employeeTotals: employeeTotalsWithFlags,
      accessibleDepartments,
      totalEntries: entries.length,
      overtimeConfig: overtimeConfig
        ? {
            dailyThreshold: overtimeConfig.dailyThreshold,
            weeklyThreshold: overtimeConfig.weeklyThreshold,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching team entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team entries' },
      { status: 500 }
    );
  }
}
