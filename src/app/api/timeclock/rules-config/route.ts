import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { getTimeclockRulesConfig, invalidateRulesConfigCache } from '@/lib/timeclock-rules';
import { timeclockRulesConfigSchema, parseWithErrors } from '@/lib/validation';

/**
 * GET /api/timeclock/rules-config
 * Get the timeclock rules configuration
 */
export async function GET() {
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

    const config = await getTimeclockRulesConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching rules config:', error);
    return NextResponse.json({ error: 'Failed to fetch rules configuration' }, { status: 500 });
  }
}

/**
 * PUT /api/timeclock/rules-config
 * Update the timeclock rules configuration
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

    const canManage = hasPermission(userWithPerms.permissions, 'timeclock', 'canManageConfig');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseWithErrors(timeclockRulesConfigSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const currentConfig = await getTimeclockRulesConfig();
    const previousConfig = { ...currentConfig };

    const updatedConfig = await prisma.timeclockRulesConfig.update({
      where: { id: currentConfig.id },
      data: parsed.data,
    });

    invalidateRulesConfigCache();

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'TIMECLOCK_RULES_CONFIG_UPDATED',
      entityType: 'TimeclockRulesConfig',
      entityId: updatedConfig.id,
      changes: {
        before: previousConfig,
        after: updatedConfig,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ config: updatedConfig });
  } catch (error) {
    console.error('Error updating rules config:', error);
    return NextResponse.json({ error: 'Failed to update rules configuration' }, { status: 500 });
  }
}
