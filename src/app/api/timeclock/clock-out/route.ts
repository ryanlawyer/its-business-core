import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { processClockOut } from '@/lib/timeclock-rules';
import { createAuditLog } from '@/lib/audit';


export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Check if user can clock in/out
    if (!hasPermission(permissions, 'timeclock', 'canClockInOut')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = user.id;

    const now = new Date();

    // Find active entry to calculate duration
    const entry = await prisma.timeclockEntry.findFirst({
      where: {
        userId,
        clockOut: null,
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Not clocked in' },
        { status: 400 }
      );
    }

    const clockIn = new Date(entry.clockIn);
    const rawDurationSeconds = Math.floor((now.getTime() - clockIn.getTime()) / 1000);

    // Process through rules engine: break deduction -> rounding -> min duration -> auto-approve
    const result = await processClockOut(rawDurationSeconds, userId);

    // Build update data with processed values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      clockOut: now,
      duration: result.finalDuration,
      rawDuration: result.rawDuration,
      breakDeducted: result.breakDeducted > 0 ? result.breakDeducted : null,
      flagReason: result.flagReason,
      autoApproved: result.autoApproved,
      status: result.status,
      rejectedNote: result.rejectedNote,
      updatedAt: now,
    };

    // If auto-approved, set approval fields
    if (result.autoApproved) {
      updateData.approvedAt = now;
      updateData.approvedBy = 'system';
      updateData.isLocked = true;
    }

    // Use updateMany to atomically update only entries with clockOut IS NULL
    const updateResult = await prisma.timeclockEntry.updateMany({
      where: { userId, clockOut: null },
      data: updateData,
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Not clocked in' },
        { status: 400 }
      );
    }

    // Fetch the updated entry for the response
    const updated = await prisma.timeclockEntry.findUnique({
      where: { id: entry.id },
    });

    // Audit log for auto-approve/auto-reject events
    if (result.autoApproved) {
      createAuditLog({
        userId: 'system',
        action: 'TIMECLOCK_ENTRY_AUTO_APPROVED',
        entityType: 'TimeclockEntry',
        entityId: entry.id,
        changes: {
          after: {
            duration: result.finalDuration,
            rawDuration: result.rawDuration,
            breakDeducted: result.breakDeducted,
            autoApproved: true,
          },
        },
      });
    } else if (result.status === 'rejected') {
      createAuditLog({
        userId: 'system',
        action: 'TIMECLOCK_ENTRY_AUTO_REJECTED',
        entityType: 'TimeclockEntry',
        entityId: entry.id,
        changes: {
          after: {
            duration: result.finalDuration,
            flagReason: result.flagReason,
            rejectedNote: result.rejectedNote,
          },
        },
      });
    }

    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error('Error clocking out:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
