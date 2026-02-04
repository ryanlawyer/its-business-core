import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/timeclock/[id]
 * Get a single timeclock entry
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const entry = await prisma.timeclockEntry.findUnique({
      where: { id },
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
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Check permissions - user can view their own, or needs canViewTeamEntries/canViewAllEntries
    const isOwnEntry = entry.userId === session.user.id;

    if (!isOwnEntry) {
      const userWithPerms = await getUserWithPermissions(session.user.id);
      if (!userWithPerms) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const canViewTeam = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewTeamEntries');
      const canViewAll = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewAllEntries');

      if (!canViewTeam && !canViewAll) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Check department assignment if not admin
      if (!canViewAll) {
        const assignments = await prisma.managerAssignment.findMany({
          where: { userId: session.user.id },
          select: { departmentId: true },
        });
        const assignedDeptIds = assignments.map((a) => a.departmentId);

        if (!entry.user.department || !assignedDeptIds.includes(entry.user.department.id)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error fetching timeclock entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeclock entry' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/timeclock/[id]
 * Edit a timeclock entry (managers only)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canEditTeam = hasPermission(userWithPerms.permissions, 'timeclock', 'canEditTeamEntries');
    const canViewAll = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewAllEntries');

    if (!canEditTeam) {
      return NextResponse.json(
        { error: 'You do not have permission to edit timeclock entries' },
        { status: 403 }
      );
    }

    // Find the entry
    const entry = await prisma.timeclockEntry.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Check if entry is locked
    if (entry.isLocked) {
      return NextResponse.json(
        { error: 'Cannot edit locked entries' },
        { status: 400 }
      );
    }

    // Check department assignment if not admin
    if (!canViewAll) {
      const assignments = await prisma.managerAssignment.findMany({
        where: { userId: session.user.id },
        select: { departmentId: true },
      });
      const assignedDeptIds = assignments.map((a) => a.departmentId);

      if (!entry.user.department || !assignedDeptIds.includes(entry.user.department.id)) {
        return NextResponse.json(
          { error: 'You can only edit entries in your assigned departments' },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await req.json();
    const { clockIn, clockOut } = body;

    // Validate input
    if (!clockIn && !clockOut) {
      return NextResponse.json(
        { error: 'At least one of clockIn or clockOut is required' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: {
      clockIn?: Date;
      clockOut?: Date | null;
      duration?: number | null;
      lastEditedBy: string;
      lastEditedAt: Date;
    } = {
      lastEditedBy: session.user.id,
      lastEditedAt: new Date(),
    };

    const newClockIn = clockIn ? new Date(clockIn) : entry.clockIn;
    let newClockOut = entry.clockOut;

    if (clockIn) {
      updateData.clockIn = newClockIn;
    }

    if (clockOut !== undefined) {
      if (clockOut === null) {
        updateData.clockOut = null;
        newClockOut = null;
      } else {
        updateData.clockOut = new Date(clockOut);
        newClockOut = updateData.clockOut;
      }
    }

    // Recalculate duration if we have both times
    if (newClockOut) {
      const durationSeconds = Math.round((newClockOut.getTime() - newClockIn.getTime()) / 1000);
      if (durationSeconds < 0) {
        return NextResponse.json(
          { error: 'Clock out time cannot be before clock in time' },
          { status: 400 }
        );
      }
      updateData.duration = durationSeconds;
    } else {
      updateData.duration = null;
    }

    // Update the entry
    const updatedEntry = await prisma.timeclockEntry.update({
      where: { id },
      data: updateData,
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
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'TIMECLOCK_ENTRY_EDITED',
      entityType: 'TimeclockEntry',
      entityId: entry.id,
      changes: {
        before: {
          clockIn: entry.clockIn.toISOString(),
          clockOut: entry.clockOut?.toISOString() || null,
          duration: entry.duration,
        },
        after: {
          clockIn: updatedEntry.clockIn.toISOString(),
          clockOut: updatedEntry.clockOut?.toISOString() || null,
          duration: updatedEntry.duration,
        },
        editedUser: entry.user.name,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error updating timeclock entry:', error);
    return NextResponse.json(
      { error: 'Failed to update timeclock entry' },
      { status: 500 }
    );
  }
}
