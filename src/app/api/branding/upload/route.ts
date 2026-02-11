import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';
import { getSettings, updateSettings } from '@/lib/settings';
import { createAuditLog } from '@/lib/audit';
import { resolveUploadPath } from '@/lib/file-utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BRANDING_DIR = 'branding';

const ALLOWED_TYPES: Record<string, { mimeTypes: string[]; maxSize: number; extensions: string[] }> = {
  logo: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    maxSize: 2 * 1024 * 1024, // 2MB
    extensions: ['.png', '.jpg', '.jpeg', '.svg'],
  },
  favicon: {
    mimeTypes: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'],
    maxSize: 500 * 1024, // 500KB
    extensions: ['.png', '.ico', '.svg'],
  },
};

/**
 * POST /api/branding/upload — Upload logo or favicon
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'settings', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file || !type) {
      return NextResponse.json({ error: 'Missing file or type' }, { status: 400 });
    }

    const config = ALLOWED_TYPES[type];
    if (!config) {
      return NextResponse.json({ error: 'Invalid type. Must be "logo" or "favicon"' }, { status: 400 });
    }

    // Validate mime type
    if (!config.mimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${config.extensions.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > config.maxSize) {
      const maxMB = config.maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large. Maximum size: ${maxMB >= 1 ? maxMB + 'MB' : (config.maxSize / 1024) + 'KB'}` },
        { status: 400 }
      );
    }

    // Determine extension from filename
    const origExt = path.extname(file.name).toLowerCase();
    const ext = config.extensions.includes(origExt) ? origExt : config.extensions[0];

    // Generate unique filename
    const uniqueName = `${type}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const relativePath = path.join(BRANDING_DIR, uniqueName);

    // Resolve and validate path
    const absolutePath = resolveUploadPath(relativePath);
    if (!absolutePath) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Delete old file if exists
    const settings = getSettings();
    const oldPath = type === 'logo' ? settings.organization.logo : settings.organization.favicon;
    if (oldPath) {
      const oldAbsolute = resolveUploadPath(oldPath);
      if (oldAbsolute && fs.existsSync(oldAbsolute)) {
        fs.unlinkSync(oldAbsolute);
      }
    }

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absolutePath, buffer);

    // Update settings
    if (type === 'logo') {
      settings.organization.logo = relativePath;
    } else {
      settings.organization.favicon = relativePath;
    }
    updateSettings(settings);

    // Audit log
    createAuditLog({
      userId: session.user.id!,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: 'branding',
      changes: { field: type, action: 'uploaded', filename: file.name },
    }).catch(() => {});

    return NextResponse.json({ success: true, path: relativePath });
  } catch (error) {
    console.error('Error uploading branding:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

/**
 * DELETE /api/branding/upload — Remove logo or favicon
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'settings', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const type = body.type as string;

    if (type !== 'logo' && type !== 'favicon') {
      return NextResponse.json({ error: 'Invalid type. Must be "logo" or "favicon"' }, { status: 400 });
    }

    const settings = getSettings();
    const filePath = type === 'logo' ? settings.organization.logo : settings.organization.favicon;

    // Delete the file if it exists
    if (filePath) {
      const absolutePath = resolveUploadPath(filePath);
      if (absolutePath && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    // Update settings
    if (type === 'logo') {
      settings.organization.logo = null;
    } else {
      settings.organization.favicon = null;
    }
    updateSettings(settings);

    // Audit log
    createAuditLog({
      userId: session.user.id!,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: 'branding',
      changes: { field: type, action: 'removed' },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing branding:', error);
    return NextResponse.json({ error: 'Failed to remove file' }, { status: 500 });
  }
}
