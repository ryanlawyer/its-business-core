import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/timeclock/[id]/reject
 * Reject a timeclock entry
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const canApprove = hasPermission(userWithPerms.permissions, 'timeclock', 'canApproveEntries');
    const canViewAll = hasPermission(userWithPerms.permissions, 'timeclock', 'canViewAllEntries');

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to reject entries' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { rejectedNote } = body;

    // Rejection note is required
    if (!rejectedNote || typeof rejectedNote !== 'string' || rejectedNote.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection note is required' },
        { status: 400 }
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

    // Cannot reject active entries (no clockOut)
    if (!entry.clockOut) {
      return NextResponse.json(
        { error: 'Cannot reject active entries. Please wait for clock out.' },
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
          { error: 'You can only reject entries in your assigned departments' },
          { status: 403 }
        );
      }
    }

    // Reject the entry
    const updatedEntry = await prisma.timeclockEntry.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedNote: rejectedNote.trim(),
        isLocked: false, // Unlock to allow edits
        // Clear approval fields
        approvedBy: null,
        approvedAt: null,
      },
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
      action: 'TIMECLOCK_ENTRY_REJECTED',
      entityType: 'TimeclockEntry',
      entityId: entry.id,
      changes: {
        before: {
          status: entry.status,
          isLocked: entry.isLocked,
        },
        after: {
          status: 'rejected',
          isLocked: false,
          rejectedNote: rejectedNote.trim(),
        },
        employeeName: entry.user.name,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error rejecting timeclock entry:', error);
    return NextResponse.json(
      { error: 'Failed to reject timeclock entry' },
      { status: 500 }
    );
  }
}
