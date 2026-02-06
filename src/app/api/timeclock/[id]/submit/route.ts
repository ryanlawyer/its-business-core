import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/timeclock/[id]/submit
 * Employee attestation — submit a completed entry for review
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

    const canClockInOut = hasPermission(userWithPerms.permissions, 'timeclock', 'canClockInOut');
    if (!canClockInOut) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the entry
    const entry = await prisma.timeclockEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Can only submit own entries
    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Can only submit your own entries' }, { status: 403 });
    }

    // Must be completed (has clockOut) and pending
    if (!entry.clockOut) {
      return NextResponse.json(
        { error: 'Cannot submit an active entry. Please clock out first.' },
        { status: 400 },
      );
    }

    if (entry.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot submit entry with status "${entry.status}"` },
        { status: 400 },
      );
    }

    // Update status to submitted
    const updatedEntry = await prisma.timeclockEntry.update({
      where: { id },
      data: { status: 'submitted' },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'TIMECLOCK_ENTRY_SUBMITTED',
      entityType: 'TimeclockEntry',
      entityId: entry.id,
      changes: {
        before: { status: 'pending' },
        after: { status: 'submitted' },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error submitting timeclock entry:', error);
    return NextResponse.json(
      { error: 'Failed to submit timeclock entry' },
      { status: 500 },
    );
  }
}
