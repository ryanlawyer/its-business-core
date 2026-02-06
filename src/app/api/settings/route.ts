import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSettings, updateSettings, redactSensitiveSettings, SystemSettings } from '@/lib/settings';
import { createAuditLog, getRequestContext } from '@/lib/audit';

// GET /api/settings - Get current system settings
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with role permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = JSON.parse(user.role.permissions);

    // Check if user can manage settings
    if (!permissions.settings?.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = getSettings();

    // Redact secrets unless explicitly requested
    const includeSecrets = req.nextUrl.searchParams.get('includeSecrets') === 'true';
    const responseSettings = includeSecrets ? settings : redactSensitiveSettings(settings);

    return NextResponse.json({ settings: responseSettings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update system settings
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with role permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = JSON.parse(user.role.permissions);

    // Check if user can manage settings
    if (!permissions.settings?.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const newSettings: SystemSettings = body.settings;

    // Validate settings
    if (!newSettings.organization || !newSettings.security || !newSettings.purchaseOrders) {
      return NextResponse.json(
        { error: 'Invalid settings structure' },
        { status: 400 }
      );
    }

    // Get current settings for audit log
    const oldSettings = getSettings();

    // Update settings
    updateSettings(newSettings);

    // Audit log the change — redact secrets from the before/after objects
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      changes: {
        before: redactSensitiveSettings(oldSettings),
        after: redactSensitiveSettings(newSettings),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ settings: redactSensitiveSettings(newSettings) });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
