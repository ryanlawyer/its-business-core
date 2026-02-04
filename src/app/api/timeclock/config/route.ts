import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/timeclock/config
 * Get pay period configuration
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

    const canManage = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canManageConfig'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to view timeclock configuration' },
        { status: 403 }
      );
    }

    // Get or create default config (singleton pattern)
    let config = await prisma.payPeriodConfig.findFirst();

    if (!config) {
      // Create default config
      config = await prisma.payPeriodConfig.create({
        data: {
          type: 'biweekly',
          startDayOfWeek: 0, // Sunday
          startDate: new Date(), // Today as reference
        },
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching pay period config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pay period configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/timeclock/config
 * Update pay period configuration
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canManage = hasPermission(
      userWithPerms.permissions,
      'timeclock',
      'canManageConfig'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to update timeclock configuration' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, startDayOfWeek, startDate } = body;

    // Validate pay period type
    const validTypes = ['weekly', 'biweekly', 'semimonthly', 'monthly'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid pay period type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate startDayOfWeek (0-6)
    if (startDayOfWeek !== undefined && startDayOfWeek !== null) {
      const dayNum = parseInt(startDayOfWeek);
      if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
        return NextResponse.json(
          { error: 'Start day of week must be between 0 (Sunday) and 6 (Saturday)' },
          { status: 400 }
        );
      }
    }

    // Get or create config
    let config = await prisma.payPeriodConfig.findFirst();
    const previousConfig = config ? { ...config } : null;

    const updateData: {
      type?: string;
      startDayOfWeek?: number | null;
      startDate?: Date | null;
    } = {};

    if (type !== undefined) {
      updateData.type = type;
    }

    if (startDayOfWeek !== undefined) {
      updateData.startDayOfWeek = startDayOfWeek !== null ? parseInt(startDayOfWeek) : null;
    }

    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }

    if (config) {
      // Update existing config
      config = await prisma.payPeriodConfig.update({
        where: { id: config.id },
        data: updateData,
      });
    } else {
      // Create new config
      config = await prisma.payPeriodConfig.create({
        data: {
          type: type || 'biweekly',
          startDayOfWeek: startDayOfWeek !== undefined ? parseInt(startDayOfWeek) : 0,
          startDate: startDate ? new Date(startDate) : new Date(),
        },
      });
    }

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: previousConfig ? 'PAY_PERIOD_CONFIG_UPDATED' : 'PAY_PERIOD_CONFIG_CREATED',
      entityType: 'PayPeriodConfig',
      entityId: config.id,
      changes: {
        before: previousConfig
          ? {
              type: previousConfig.type,
              startDayOfWeek: previousConfig.startDayOfWeek,
              startDate: previousConfig.startDate?.toISOString(),
            }
          : null,
        after: {
          type: config.type,
          startDayOfWeek: config.startDayOfWeek,
          startDate: config.startDate?.toISOString(),
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error updating pay period config:', error);
    return NextResponse.json(
      { error: 'Failed to update pay period configuration' },
      { status: 500 }
    );
  }
}
