import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';

/**
 * POST /api/admin/restore
 * Restores from a backup archive
 *
 * Requires admin permission (settings.canManage)
 *
 * Process:
 * 1. Validates the backup archive (checks manifest.json)
 * 2. Creates a safety backup before restoring
 * 3. Extracts and applies the backup
 * 4. Returns success/error status
 */
export async function POST(req: NextRequest) {
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
        { error: 'You do not have permission to restore backups' },
        { status: 403 }
      );
    }

    // Get the uploaded file
    const formData = await req.formData();
    const file = formData.get('backup') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No backup file provided' }, { status: 400 });
    }

    // Validate file extension
    if (!file.name.endsWith('.tar.gz') && !file.name.endsWith('.tgz')) {
      return NextResponse.json(
        { error: 'Invalid file format. Expected .tar.gz or .tgz archive.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Create temp directories
    const tempDir = path.join('/tmp', `restore-${Date.now()}`);
    const safetyBackupDir = path.join('/tmp', `safety-backup-${Date.now()}`);

    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(safetyBackupDir, { recursive: true });

    try {
      // Write buffer to temp file
      const tempArchive = path.join(tempDir, 'backup.tar.gz');
      fs.writeFileSync(tempArchive, fileBuffer);

      // Extract the archive
      const extractPath = path.join(tempDir, 'extracted');
      fs.mkdirSync(extractPath, { recursive: true });

      await tar.extract({
        file: tempArchive,
        cwd: extractPath,
        strip: 0,
        filter: (entryPath: string) => {
          // Block path traversal: reject entries containing '..' or starting with '/'
          if (entryPath.includes('..') || entryPath.startsWith('/')) {
            console.warn('Blocked suspicious tar entry path:', entryPath);
            return false;
          }
          return true;
        },
      });

      // Validate all extracted paths stay within extractPath
      const resolvedExtract = path.resolve(extractPath);
      function validateExtractedPaths(dir: string): void {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.resolve(dir, item.name);
          if (!fullPath.startsWith(resolvedExtract)) {
            throw new Error(`Path traversal detected in extracted archive: ${item.name}`);
          }
          if (item.isSymbolicLink()) {
            throw new Error(`Symbolic link detected in extracted archive: ${item.name}`);
          }
          if (item.isDirectory()) {
            validateExtractedPaths(fullPath);
          }
        }
      }
      validateExtractedPaths(extractPath);

      // Validate manifest
      const manifestPath = path.join(extractPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Invalid backup: manifest.json not found');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!manifest.type || !manifest.timestamp) {
        throw new Error('Invalid backup: manifest missing required fields (type, timestamp)');
      }

      // Validate database exists in backup
      const dbBackupPath = path.join(extractPath, 'database.db');
      if (!fs.existsSync(dbBackupPath)) {
        throw new Error('Invalid backup: database.db not found');
      }

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
      const configDir = path.join(projectRoot, 'config');

      // Create safety backup of current data
      const safetyManifest = {
        type: 'safety-backup',
        timestamp: new Date().toISOString(),
        reason: 'pre-restore-safety',
        originalBackup: {
          type: manifest.type,
          timestamp: manifest.timestamp,
          filename: file.name,
        },
        files_backed_up: [] as string[],
      };

      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(safetyBackupDir, 'database.db'));
        safetyManifest.files_backed_up.push('database.db');
      }

      if (fs.existsSync(uploadDir)) {
        const safetyUploadPath = path.join(safetyBackupDir, 'uploads');
        fs.mkdirSync(safetyUploadPath, { recursive: true });
        copyDirectorySync(uploadDir, safetyUploadPath);
        safetyManifest.files_backed_up.push('uploads/');
      }

      if (fs.existsSync(secretsPath)) {
        fs.copyFileSync(secretsPath, path.join(safetyBackupDir, '.secrets'));
        safetyManifest.files_backed_up.push('.secrets');
      }

      // Write safety backup manifest
      fs.writeFileSync(
        path.join(safetyBackupDir, 'safety-manifest.json'),
        JSON.stringify(safetyManifest, null, 2)
      );

      // Restore database
      const dbDir = path.dirname(dbPath);
      fs.mkdirSync(dbDir, { recursive: true });
      fs.copyFileSync(dbBackupPath, dbPath);

      // Restore uploads
      const uploadsBackupPath = path.join(extractPath, 'uploads');
      if (fs.existsSync(uploadsBackupPath)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        // Clear existing uploads
        const existingFiles = fs.readdirSync(uploadDir);
        for (const f of existingFiles) {
          fs.rmSync(path.join(uploadDir, f), { recursive: true, force: true });
        }
        // Copy new uploads
        copyDirectorySync(uploadsBackupPath, uploadDir);
      }

      // Restore config directory if present in backup
      const configBackupPath = path.join(extractPath, 'config');
      if (fs.existsSync(configBackupPath)) {
        fs.mkdirSync(configDir, { recursive: true });
        copyDirectorySync(configBackupPath, configDir);
      }

      // Restore secrets (full backup only)
      const secretsBackupPath = path.join(extractPath, '.secrets');
      if (manifest.type === 'full' && fs.existsSync(secretsBackupPath)) {
        fs.copyFileSync(secretsBackupPath, secretsPath);
      }

      // Clean up temp directories (but keep safety backup for a while)
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Note: Safety backup is kept in /tmp for potential recovery
      // It will be auto-cleaned by the OS eventually

      return NextResponse.json({
        success: true,
        message: 'Restore completed successfully',
        details: {
          backupType: manifest.type,
          backupTimestamp: manifest.timestamp,
          backupVersion: manifest.version,
          restoredAt: new Date().toISOString(),
          restoredBy: session.user.email,
        },
      });
    } catch (extractError) {
      // Clean up on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      // Keep safety backup on error for manual recovery
      throw extractError;
    }
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json(
      {
        error: 'Failed to restore backup',
      },
      { status: 500 }
    );
  }
}

/**
 * Recursively copy a directory, skipping symlinks and validating paths
 * stay within the expected root directories.
 */
function copyDirectorySync(src: string, dest: string): void {
  const resolvedSrc = path.resolve(src);
  const resolvedDest = path.resolve(dest);
  const entries = fs.readdirSync(resolvedSrc, { withFileTypes: true });

  for (const entry of entries) {
    // Skip symbolic links to prevent path traversal
    if (entry.isSymbolicLink()) {
      console.warn('Skipping symbolic link during copy:', entry.name);
      continue;
    }

    const srcPath = path.resolve(resolvedSrc, entry.name);
    const destPath = path.resolve(resolvedDest, entry.name);

    // Validate paths stay within their root directories
    if (!srcPath.startsWith(resolvedSrc + path.sep) && srcPath !== resolvedSrc) {
      console.warn('Blocked path traversal in source:', srcPath);
      continue;
    }
    if (!destPath.startsWith(resolvedDest + path.sep) && destPath !== resolvedDest) {
      console.warn('Blocked path traversal in destination:', destPath);
      continue;
    }

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
