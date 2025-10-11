import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';


export async function GET() {
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

    // Check if user can view their own entries
    if (!hasPermission(permissions, 'timeclock', 'canViewOwnEntries')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = user.id;

    // Get active entry (no clock out)
    const activeEntry = await prisma.timeclockEntry.findFirst({
      where: {
        userId,
        clockOut: null,
      },
    });

    // Get recent entries (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const entries = await prisma.timeclockEntry.findMany({
      where: {
        userId,
        clockIn: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        clockIn: 'desc',
      },
      take: 20,
    });

    return NextResponse.json({
      activeEntry,
      entries,
    });
  } catch (error) {
    console.error('Error fetching timeclock entries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
