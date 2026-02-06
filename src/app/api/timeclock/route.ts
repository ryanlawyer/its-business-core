import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { getCurrentPayPeriod, getRecentPeriods, PayPeriod } from '@/lib/pay-period';
import { calculateOvertime, TimeclockEntryForCalculation } from '@/lib/overtime';
import { getSystemConfig } from '@/lib/setup-status';

export async function GET(req: NextRequest) {
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

    // Parse query params for period selection
    const searchParams = req.nextUrl.searchParams;
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    // Get pay period config
    const payPeriodConfig = await prisma.payPeriodConfig.findFirst();
    const overtimeConfig = await prisma.overtimeConfig.findFirst();

    // Calculate current period and available periods
    const currentPeriod = getCurrentPayPeriod(payPeriodConfig);
    const availablePeriods = getRecentPeriods(payPeriodConfig, 6);

    // Determine the date range to query
    let queryStart: Date;
    let queryEnd: Date;
    let selectedPeriod: PayPeriod;

    if (periodStart && periodEnd) {
      queryStart = new Date(periodStart);
      queryEnd = new Date(periodEnd);
      queryEnd.setHours(23, 59, 59, 999);
      selectedPeriod = {
        startDate: queryStart,
        endDate: queryEnd,
        label: currentPeriod.label,
        type: currentPeriod.type,
      };
    } else {
      queryStart = currentPeriod.startDate;
      queryEnd = currentPeriod.endDate;
      selectedPeriod = currentPeriod;
    }

    // Get active entry (no clock out)
    const activeEntry = await prisma.timeclockEntry.findFirst({
      where: {
        userId,
        clockOut: null,
      },
    });

    // Get entries for the selected period
    const periodEntries = await prisma.timeclockEntry.findMany({
      where: {
        userId,
        clockIn: {
          gte: queryStart,
          lte: queryEnd,
        },
      },
      orderBy: {
        clockIn: 'desc',
      },
    });

    // Get today's entries for "today's totals"
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEntries = periodEntries.filter((entry) => {
      const clockIn = new Date(entry.clockIn);
      return clockIn >= today && clockIn < tomorrow;
    });

    // Calculate today's total
    const todayTotalSeconds = todayEntries.reduce((sum, entry) => {
      return sum + (entry.duration || 0);
    }, 0);

    // Calculate period totals and overtime
    const completedEntries = periodEntries.filter(
      (e) => e.clockOut && e.duration
    );

    const calcEntries: TimeclockEntryForCalculation[] = completedEntries.map(
      (e) => ({
        id: e.id,
        userId: e.userId,
        clockIn: new Date(e.clockIn),
        clockOut: e.clockOut ? new Date(e.clockOut) : null,
        duration: e.duration,
        status: e.status,
      })
    );

    const timezone = await getSystemConfig('timezone') || 'UTC';
    const overtimeResult = calculateOvertime(calcEntries, overtimeConfig, timezone);
    const userOT = overtimeResult.employees[userId];

    // Period stats
    const periodStats = {
      totalMinutes: userOT?.totalMinutes || 0,
      regularMinutes: userOT?.regularMinutes || 0,
      dailyOvertimeMinutes: userOT?.dailyOvertimeMinutes || 0,
      weeklyOvertimeMinutes: userOT?.weeklyOvertimeMinutes || 0,
      sessionsCompleted: completedEntries.length,
      pendingCount: periodEntries.filter((e) => e.status === 'pending').length,
      approvedCount: periodEntries.filter((e) => e.status === 'approved').length,
      rejectedCount: periodEntries.filter((e) => e.status === 'rejected').length,
    };

    // Today stats
    const todayStats = {
      totalSeconds: todayTotalSeconds,
      sessionsCompleted: todayEntries.filter((e) => e.clockOut).length,
    };

    return NextResponse.json({
      activeEntry,
      entries: periodEntries,
      currentPeriod: selectedPeriod,
      availablePeriods,
      periodStats,
      todayStats,
      overtimeConfig: overtimeConfig
        ? {
            dailyThreshold: overtimeConfig.dailyThreshold,
            weeklyThreshold: overtimeConfig.weeklyThreshold,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching timeclock entries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
