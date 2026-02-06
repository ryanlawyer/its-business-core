import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { checkAlertStatus, TimeclockEntryForCalculation } from '@/lib/overtime';
import { getSystemConfig } from '@/lib/setup-status';

/**
 * GET /api/timeclock/alerts
 * Get overtime alert status for the current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get overtime config
    const config = await prisma.overtimeConfig.findFirst();

    // If no config or employee notifications disabled, return null
    if (!config || !config.notifyEmployee) {
      return NextResponse.json({ alertStatus: null });
    }

    // Get user's entries for today and this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const entries = await prisma.timeclockEntry.findMany({
      where: {
        userId: session.user.id,
        clockIn: {
          gte: startOfWeek,
        },
      },
      select: {
        id: true,
        userId: true,
        clockIn: true,
        clockOut: true,
        duration: true,
        status: true,
      },
    });

    // Check if there's an active entry
    const activeEntry = entries.find((e) => !e.clockOut);
    let activeMinutes = 0;
    if (activeEntry) {
      const diff = now.getTime() - new Date(activeEntry.clockIn).getTime();
      activeMinutes = Math.floor(diff / 60000);
    }

    // Convert entries to calculation format
    const calcEntries: TimeclockEntryForCalculation[] = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      clockIn: new Date(e.clockIn),
      clockOut: e.clockOut ? new Date(e.clockOut) : null,
      duration: e.duration,
      status: e.status,
    }));

    // Calculate alert status
    const timezone = await getSystemConfig('timezone') || 'UTC';
    const alertStatus = checkAlertStatus(calcEntries, config, now, activeMinutes, timezone);

    return NextResponse.json({
      alertStatus,
      config: {
        dailyThreshold: config.dailyThreshold,
        weeklyThreshold: config.weeklyThreshold,
        notifyEmployee: config.notifyEmployee,
      },
    });
  } catch (error) {
    console.error('Error fetching alert status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert status' },
      { status: 500 }
    );
  }
}
