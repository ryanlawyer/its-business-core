import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { PassThrough } from 'stream';

/**
 * GET /api/admin/backup?type=data|full
 * Creates and downloads a backup archive
 *
 * Requires admin permission (settings.canManage)
 *
 * Types:
 * - data: Database + uploads (default)
 * - full: Database + uploads + secrets + system config export
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission (settings.canManage)
    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canManage = hasPermission(userWithPerms.permissions, 'settings', 'canManage');
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to create backups' },
        { status: 403 }
      );
    }

    // Get backup type from query params
    const { searchParams } = new URL(req.url);
    const backupType = searchParams.get('type') || 'data';

    if (!['data', 'full'].includes(backupType)) {
      return NextResponse.json(
        { error: 'Invalid backup type. Use "data" or "full".' },
        { status: 400 }
      );
    }

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `its-backup-${backupType}-${timestamp}.tar.gz`;

    // Determine paths
    const projectRoot = process.cwd();
    const dataDir = process.env.DATA_DIR || projectRoot;
    const uploadDir = process.env.UPLOAD_DIR || path.join(projectRoot, 'uploads');

    // Database path (from DATABASE_URL or default)
    const dbUrl = process.env.SQLITE_URL || 'file:./dev.db';
    const dbFileName = dbUrl.replace('file:', '').replace('./', '');
    const dbPath = path.isAbsolute(dbFileName)
      ? dbFileName
      : path.join(projectRoot, dbFileName);

    const secretsPath = path.join(dataDir, '.secrets');
    const settingsPath = path.join(projectRoot, 'config', 'system-settings.json');

    // Create manifest
    const manifest = {
      type: backupType,
      timestamp: new Date().toISOString(),
      version: '1.0',
      created_by: 'its-business-core-api',
      created_by_user: session.user.email,
      files_included: [] as string[],
    };

    // Create archive using archiver
    const archive = archiver('tar', { gzip: true });
    const chunks: Buffer[] = [];

    // Collect chunks
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    // Add database if exists
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'database.db' });
      manifest.files_included.push('database.db');
    }

    // Add uploads directory if exists
    if (fs.existsSync(uploadDir)) {
      const uploadsBasename = path.basename(uploadDir);
      archive.directory(uploadDir, 'uploads');
      manifest.files_included.push('uploads/');
    }

    // Add settings file if exists
    if (fs.existsSync(settingsPath)) {
      archive.file(settingsPath, { name: 'config/system-settings.json' });
      manifest.files_included.push('config/system-settings.json');
    }

    // Full backup extras
    if (backupType === 'full') {
      // NOTE: .secrets file is intentionally excluded from backups for security

      // Add system config export from database
      try {
        const systemConfig = await prisma.systemConfig.findMany();
        const systemSettings = await prisma.systemSettings.findMany();

        // Create a combined config export
        const configExport = {
          systemConfig,
          systemSettings,
          exportedAt: new Date().toISOString(),
        };

        archive.append(JSON.stringify(configExport, null, 2), {
          name: 'system_config_export.json'
        });
        manifest.files_included.push('system_config_export.json');
      } catch (e) {
        // Tables might not exist, add empty export
        const configExport = {
          systemConfig: [],
          systemSettings: [],
          exportedAt: new Date().toISOString(),
          error: 'Tables may not exist',
        };
        archive.append(JSON.stringify(configExport, null, 2), {
          name: 'system_config_export.json'
        });
        manifest.files_included.push('system_config_export.json');
      }
    }

    // Add manifest as the first file
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Finalize the archive
    await archive.finalize();

    // Wait for archive to complete
    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
    });

    // Combine chunks into buffer
    const archiveBuffer = Buffer.concat(chunks);

    // Audit log for backup download
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'BACKUP_DOWNLOADED',
      entityType: 'System',
      entityId: 'backup',
      changes: {
        after: {
          backupType,
          filename,
          filesIncluded: manifest.files_included,
        },
      },
      ipAddress,
      userAgent,
    });

    // Return as downloadable file
    return new NextResponse(archiveBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': archiveBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create backup',
      },
      { status: 500 }
    );
  }
}
