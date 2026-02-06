import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/timeclock/config
 * Get pay period and overtime configuration
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

    // Get or create default pay period config (singleton pattern)
    let payPeriodConfig = await prisma.payPeriodConfig.findFirst();

    if (!payPeriodConfig) {
      payPeriodConfig = await prisma.payPeriodConfig.create({
        data: {
          type: 'biweekly',
          startDayOfWeek: 0, // Sunday
          startDate: new Date(), // Today as reference
        },
      });
    }

    // Get or create default overtime config (singleton pattern)
    let overtimeConfig = await prisma.overtimeConfig.findFirst();

    if (!overtimeConfig) {
      overtimeConfig = await prisma.overtimeConfig.create({
        data: {
          dailyThreshold: 480, // 8 hours in minutes
          weeklyThreshold: 2400, // 40 hours in minutes
          alertBeforeDaily: 30, // 30 minutes before
          alertBeforeWeekly: 120, // 2 hours before
          notifyEmployee: true,
          notifyManager: true,
        },
      });
    }

    // Get or create default rules config (singleton pattern)
    const { getTimeclockRulesConfig } = await import('@/lib/timeclock-rules');
    const rulesConfig = await getTimeclockRulesConfig();

    return NextResponse.json({
      payPeriodConfig,
      overtimeConfig,
      rulesConfig,
      // Keep backwards compatibility with 'config' field
      config: payPeriodConfig,
    });
  } catch (error) {
    console.error('Error fetching timeclock config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeclock configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/timeclock/config
 * Update pay period and/or overtime configuration
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
    const {
      // Pay period fields
      type,
      startDayOfWeek,
      startDate,
      // Overtime fields
      dailyThreshold,
      weeklyThreshold,
      alertBeforeDaily,
      alertBeforeWeekly,
      notifyEmployee,
      notifyManager,
    } = body;

    const { ipAddress, userAgent } = getRequestContext(req);

    // ========== Pay Period Config ==========
    let payPeriodConfig = await prisma.payPeriodConfig.findFirst();
    const previousPayPeriodConfig = payPeriodConfig ? { ...payPeriodConfig } : null;

    // Only update pay period if any pay period fields are provided
    const hasPayPeriodFields = type !== undefined || startDayOfWeek !== undefined || startDate !== undefined;

    if (hasPayPeriodFields) {
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

      const payPeriodUpdateData: {
        type?: string;
        startDayOfWeek?: number | null;
        startDate?: Date | null;
      } = {};

      if (type !== undefined) {
        payPeriodUpdateData.type = type;
      }

      if (startDayOfWeek !== undefined) {
        payPeriodUpdateData.startDayOfWeek = startDayOfWeek !== null ? parseInt(startDayOfWeek) : null;
      }

      if (startDate !== undefined) {
        payPeriodUpdateData.startDate = startDate ? new Date(startDate) : null;
      }

      if (payPeriodConfig) {
        payPeriodConfig = await prisma.payPeriodConfig.update({
          where: { id: payPeriodConfig.id },
          data: payPeriodUpdateData,
        });
      } else {
        payPeriodConfig = await prisma.payPeriodConfig.create({
          data: {
            type: type || 'biweekly',
            startDayOfWeek: startDayOfWeek !== undefined ? parseInt(startDayOfWeek) : 0,
            startDate: startDate ? new Date(startDate) : new Date(),
          },
        });
      }

      // Audit log for pay period changes
      await createAuditLog({
        userId: session.user.id,
        action: previousPayPeriodConfig ? 'PAY_PERIOD_CONFIG_UPDATED' : 'PAY_PERIOD_CONFIG_CREATED',
        entityType: 'PayPeriodConfig',
        entityId: payPeriodConfig.id,
        changes: {
          before: previousPayPeriodConfig
            ? {
                type: previousPayPeriodConfig.type,
                startDayOfWeek: previousPayPeriodConfig.startDayOfWeek,
                startDate: previousPayPeriodConfig.startDate?.toISOString(),
              }
            : null,
          after: {
            type: payPeriodConfig.type,
            startDayOfWeek: payPeriodConfig.startDayOfWeek,
            startDate: payPeriodConfig.startDate?.toISOString(),
          },
        },
        ipAddress,
        userAgent,
      });
    } else if (!payPeriodConfig) {
      // Ensure config exists even if no fields provided
      payPeriodConfig = await prisma.payPeriodConfig.create({
        data: {
          type: 'biweekly',
          startDayOfWeek: 0,
          startDate: new Date(),
        },
      });
    }

    // ========== Overtime Config ==========
    let overtimeConfig = await prisma.overtimeConfig.findFirst();
    const previousOvertimeConfig = overtimeConfig ? { ...overtimeConfig } : null;

    // Only update overtime if any overtime fields are provided
    const hasOvertimeFields =
      dailyThreshold !== undefined ||
      weeklyThreshold !== undefined ||
      alertBeforeDaily !== undefined ||
      alertBeforeWeekly !== undefined ||
      notifyEmployee !== undefined ||
      notifyManager !== undefined;

    if (hasOvertimeFields) {
      // Validate thresholds (must be positive integers or null)
      const validateMinutes = (value: unknown, fieldName: string): number | null => {
        if (value === null || value === undefined || value === '') {
          return null;
        }
        const num = parseInt(String(value));
        if (isNaN(num) || num < 0) {
          throw new Error(`${fieldName} must be a positive number or null`);
        }
        return num;
      };

      try {
        const overtimeUpdateData: {
          dailyThreshold?: number | null;
          weeklyThreshold?: number | null;
          alertBeforeDaily?: number | null;
          alertBeforeWeekly?: number | null;
          notifyEmployee?: boolean;
          notifyManager?: boolean;
        } = {};

        if (dailyThreshold !== undefined) {
          overtimeUpdateData.dailyThreshold = validateMinutes(dailyThreshold, 'Daily threshold');
        }

        if (weeklyThreshold !== undefined) {
          overtimeUpdateData.weeklyThreshold = validateMinutes(weeklyThreshold, 'Weekly threshold');
        }

        if (alertBeforeDaily !== undefined) {
          overtimeUpdateData.alertBeforeDaily = validateMinutes(alertBeforeDaily, 'Daily alert threshold');
        }

        if (alertBeforeWeekly !== undefined) {
          overtimeUpdateData.alertBeforeWeekly = validateMinutes(alertBeforeWeekly, 'Weekly alert threshold');
        }

        if (notifyEmployee !== undefined) {
          overtimeUpdateData.notifyEmployee = Boolean(notifyEmployee);
        }

        if (notifyManager !== undefined) {
          overtimeUpdateData.notifyManager = Boolean(notifyManager);
        }

        if (overtimeConfig) {
          overtimeConfig = await prisma.overtimeConfig.update({
            where: { id: overtimeConfig.id },
            data: overtimeUpdateData,
          });
        } else {
          overtimeConfig = await prisma.overtimeConfig.create({
            data: {
              dailyThreshold: overtimeUpdateData.dailyThreshold ?? 480,
              weeklyThreshold: overtimeUpdateData.weeklyThreshold ?? 2400,
              alertBeforeDaily: overtimeUpdateData.alertBeforeDaily ?? 30,
              alertBeforeWeekly: overtimeUpdateData.alertBeforeWeekly ?? 120,
              notifyEmployee: overtimeUpdateData.notifyEmployee ?? true,
              notifyManager: overtimeUpdateData.notifyManager ?? true,
            },
          });
        }

        // Audit log for overtime changes
        await createAuditLog({
          userId: session.user.id,
          action: previousOvertimeConfig ? 'OVERTIME_CONFIG_UPDATED' : 'OVERTIME_CONFIG_CREATED',
          entityType: 'OvertimeConfig',
          entityId: overtimeConfig.id,
          changes: {
            before: previousOvertimeConfig
              ? {
                  dailyThreshold: previousOvertimeConfig.dailyThreshold,
                  weeklyThreshold: previousOvertimeConfig.weeklyThreshold,
                  alertBeforeDaily: previousOvertimeConfig.alertBeforeDaily,
                  alertBeforeWeekly: previousOvertimeConfig.alertBeforeWeekly,
                  notifyEmployee: previousOvertimeConfig.notifyEmployee,
                  notifyManager: previousOvertimeConfig.notifyManager,
                }
              : null,
            after: {
              dailyThreshold: overtimeConfig.dailyThreshold,
              weeklyThreshold: overtimeConfig.weeklyThreshold,
              alertBeforeDaily: overtimeConfig.alertBeforeDaily,
              alertBeforeWeekly: overtimeConfig.alertBeforeWeekly,
              notifyEmployee: overtimeConfig.notifyEmployee,
              notifyManager: overtimeConfig.notifyManager,
            },
          },
          ipAddress,
          userAgent,
        });
      } catch (validationError) {
        return NextResponse.json(
          { error: (validationError as Error).message },
          { status: 400 }
        );
      }
    } else if (!overtimeConfig) {
      // Ensure config exists even if no fields provided
      overtimeConfig = await prisma.overtimeConfig.create({
        data: {
          dailyThreshold: 480,
          weeklyThreshold: 2400,
          alertBeforeDaily: 30,
          alertBeforeWeekly: 120,
          notifyEmployee: true,
          notifyManager: true,
        },
      });
    }

    return NextResponse.json({
      payPeriodConfig,
      overtimeConfig,
      // Keep backwards compatibility with 'config' field
      config: payPeriodConfig,
    });
  } catch (error) {
    console.error('Error updating timeclock config:', error);
    return NextResponse.json(
      { error: 'Failed to update timeclock configuration' },
      { status: 500 }
    );
  }
}
