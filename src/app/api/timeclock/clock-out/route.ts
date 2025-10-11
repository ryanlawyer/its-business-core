import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';


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

    // Find active entry
    const entry = await prisma.timeclockEntry.findFirst({
      where: {
        userId,
        clockOut: null,
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'No active clock-in found' },
        { status: 400 }
      );
    }

    const clockOut = new Date();
    const clockIn = new Date(entry.clockIn);
    const duration = Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000);

    // Update entry
    const updated = await prisma.timeclockEntry.update({
      where: { id: entry.id },
      data: {
        clockOut,
        duration,
      },
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error('Error clocking out:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
