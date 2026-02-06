import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { lockPayPeriod, unlockPayPeriod, getPayPeriodLockStatus } from '@/lib/pay-period-lock';
import { payPeriodLockSchema, parseWithErrors } from '@/lib/validation';

/**
 * GET /api/timeclock/pay-period-lock?periodStart=X&periodEnd=X
 * Get lock status for a pay period
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canManage = hasPermission(userWithPerms.permissions, 'timeclock', 'canManageConfig');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'periodStart and periodEnd are required' }, { status: 400 });
    }

    const status = await getPayPeriodLockStatus(
      new Date(periodStart),
      new Date(periodEnd),
    );

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching pay period lock:', error);
    return NextResponse.json({ error: 'Failed to fetch pay period lock status' }, { status: 500 });
  }
}

/**
 * POST /api/timeclock/pay-period-lock
 * Lock a pay period
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canManage = hasPermission(userWithPerms.permissions, 'timeclock', 'canManageConfig');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseWithErrors(payPeriodLockSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const lock = await lockPayPeriod(
      new Date(parsed.data.periodStart),
      new Date(parsed.data.periodEnd),
      session.user.id,
    );

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'PAY_PERIOD_LOCKED',
      entityType: 'PayPeriodLock',
      entityId: lock.id,
      changes: {
        after: {
          periodStart: parsed.data.periodStart,
          periodEnd: parsed.data.periodEnd,
          lockedBy: session.user.id,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ lock });
  } catch (error) {
    console.error('Error locking pay period:', error);
    return NextResponse.json({ error: 'Failed to lock pay period' }, { status: 500 });
  }
}

/**
 * DELETE /api/timeclock/pay-period-lock
 * Unlock a pay period (admin override)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canManage = hasPermission(userWithPerms.permissions, 'timeclock', 'canManageConfig');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseWithErrors(payPeriodLockSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const lock = await unlockPayPeriod(
      new Date(parsed.data.periodStart),
      new Date(parsed.data.periodEnd),
    );

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'PAY_PERIOD_UNLOCKED',
      entityType: 'PayPeriodLock',
      entityId: lock.id,
      changes: {
        after: {
          periodStart: parsed.data.periodStart,
          periodEnd: parsed.data.periodEnd,
          unlockedBy: session.user.id,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ lock });
  } catch (error) {
    console.error('Error unlocking pay period:', error);
    return NextResponse.json({ error: 'Failed to unlock pay period' }, { status: 500 });
  }
}
