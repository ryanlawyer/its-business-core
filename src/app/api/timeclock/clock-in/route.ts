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

    // Use transaction to prevent race condition between check and create
    const result = await prisma.$transaction(async (tx) => {
      // Check if already clocked in
      const openEntry = await tx.timeclockEntry.findFirst({
        where: { userId, clockOut: null },
      });

      if (openEntry) {
        return { error: 'Already clocked in' };
      }

      // Create new entry
      const entry = await tx.timeclockEntry.create({
        data: {
          userId,
          clockIn: new Date(),
        },
      });

      return { entry };
    });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ entry: result.entry });
  } catch (error) {
    console.error('Error clocking in:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
