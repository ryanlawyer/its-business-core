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
    const durationSeconds = Math.floor((now.getTime() - clockIn.getTime()) / 1000);

    // Use updateMany to atomically update only entries with clockOut IS NULL
    const result = await prisma.timeclockEntry.updateMany({
      where: { userId, clockOut: null },
      data: { clockOut: now, duration: durationSeconds, updatedAt: now },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Not clocked in' },
        { status: 400 }
      );
    }

    // Fetch the updated entry for the response
    const updated = await prisma.timeclockEntry.findUnique({
      where: { id: entry.id },
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
