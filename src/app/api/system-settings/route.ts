import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/system-settings
 * Get all system settings
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canManage = hasPermission(
      userWithPerms.permissions,
      'settings',
      'canManage'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to view system settings' },
        { status: 403 }
      );
    }

    const settings = await prisma.systemSettings.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/system-settings
 * Update a system setting
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canManage = hasPermission(
      userWithPerms.permissions,
      'settings',
      'canManage'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to update system settings' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, key, value } = body;

    if (!id && !key) {
      return NextResponse.json(
        { error: 'Setting ID or key is required' },
        { status: 400 }
      );
    }

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      );
    }

    // Find the setting
    const existingSetting = id
      ? await prisma.systemSettings.findUnique({ where: { id } })
      : await prisma.systemSettings.findUnique({ where: { key } });

    if (!existingSetting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    // Validate value based on setting type
    if (key === 'max_file_upload_size_mb' || existingSetting.key === 'max_file_upload_size_mb') {
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 1 || numValue > 100) {
        return NextResponse.json(
          { error: 'File size must be between 1 and 100 MB' },
          { status: 400 }
        );
      }
    }

    // Update setting
    const updated = await prisma.systemSettings.update({
      where: { id: existingSetting.id },
      data: { value: value.toString() },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'SETTING_UPDATED',
      entityType: 'SystemSettings',
      entityId: updated.id,
      changes: {
        before: { value: existingSetting.value },
        after: { value: updated.value },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ setting: updated });
  } catch (error) {
    console.error('Error updating system setting:', error);
    return NextResponse.json(
      { error: 'Failed to update system setting' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system-settings
 * Create a new system setting
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canManage = hasPermission(
      userWithPerms.permissions,
      'settings',
      'canManage'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to create system settings' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { key, value, description, category } = body;

    if (!key || !value) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    // Check if key already exists
    const existing = await prisma.systemSettings.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Setting with this key already exists' },
        { status: 400 }
      );
    }

    // Create setting
    const setting = await prisma.systemSettings.create({
      data: {
        key,
        value: value.toString(),
        description: description || null,
        category: category || 'general',
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'SETTING_CREATED',
      entityType: 'SystemSettings',
      entityId: setting.id,
      changes: {
        after: { key, value, category },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ setting }, { status: 201 });
  } catch (error) {
    console.error('Error creating system setting:', error);
    return NextResponse.json(
      { error: 'Failed to create system setting' },
      { status: 500 }
    );
  }
}
