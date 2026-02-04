import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import {
  validateUploadedFile,
  generateUniqueFilename,
  isImageFile,
} from '@/lib/file-validation';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Upload directory configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/receipts';

/**
 * POST /api/receipts/upload
 * Upload a receipt image/PDF file
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { permissions } = userWithPerms;

    // Check if user can upload receipts
    if (!hasPermission(permissions, 'receipts', 'canUpload')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate the file
    const validation = await validateUploadedFile(buffer, file.name);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'File validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const uploadDir = path.resolve(UPLOAD_DIR);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(validation.sanitizedFilename || file.name);
    const uniqueFilename = `receipt_${timestamp}_${random}${ext}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Write file to disk
    await writeFile(filePath, buffer);

    // Create receipt record with pending status
    const receipt = await prisma.receipt.create({
      data: {
        userId: session.user.id,
        status: 'PENDING',
        source: 'UPLOAD',
        imageUrl: filePath,
        // Generate thumbnail URL for images (placeholder - will be implemented in OCR phase)
        thumbnailUrl: isImageFile(validation.mimeType!) ? filePath : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_UPLOADED',
      entityType: 'Receipt',
      entityId: receipt.id,
      changes: {
        after: {
          filename: uniqueFilename,
          mimeType: validation.mimeType,
          size: buffer.length,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      receipt,
      message: 'Receipt uploaded successfully. Processing will begin shortly.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
