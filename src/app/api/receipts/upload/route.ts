import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import {
  validateUploadedFile,
  isImageFile,
  isPdfFile,
} from '@/lib/file-validation';
import { optimizeReceiptImage } from '@/lib/image-processing';
import { optimizeReceiptPdf } from '@/lib/pdf-optimization';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Upload directory configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/receipts';
const THUMBNAIL_DIR = process.env.UPLOAD_DIR
  ? path.join(path.dirname(process.env.UPLOAD_DIR), 'thumbnails')
  : './uploads/thumbnails';

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

    const mimeType = validation.mimeType!;
    const uuid = crypto.randomUUID();
    let fileBuffer: Buffer = buffer;
    let thumbnailBuffer: Buffer | null = null;
    let optimizationMeta: Record<string, unknown> = {};

    // Optimize based on file type
    if (isImageFile(mimeType)) {
      const result = await optimizeReceiptImage(buffer);
      fileBuffer = result.buffer;
      thumbnailBuffer = result.thumbnailBuffer;
      optimizationMeta = {
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        savedBytes: result.originalSize - result.optimizedSize,
        dimensions: `${result.width}x${result.height}`,
        steps: result.steps,
      };
    } else if (isPdfFile(mimeType)) {
      const result = await optimizeReceiptPdf(buffer);
      fileBuffer = result.buffer;
      optimizationMeta = {
        originalSize: result.originalSize,
        optimizedSize: result.newSize,
        savedBytes: result.originalSize - result.newSize,
        method: result.method,
        optimized: result.optimized,
      };
    }

    // Use .jpg extension for all optimized images, preserve .pdf for PDFs
    const ext = isImageFile(mimeType) ? '.jpg' : '.pdf';
    const uniqueFilename = `receipt_${uuid}${ext}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Write optimized file to disk
    await writeFile(filePath, fileBuffer);

    // Write thumbnail if generated
    let thumbnailUrl: string | null = null;
    if (thumbnailBuffer) {
      const thumbDir = path.resolve(THUMBNAIL_DIR);
      if (!existsSync(thumbDir)) {
        await mkdir(thumbDir, { recursive: true });
      }
      const thumbFilename = `thumb_${uuid}.jpg`;
      const thumbPath = path.join(thumbDir, thumbFilename);
      await writeFile(thumbPath, thumbnailBuffer);
      thumbnailUrl = `thumbnails/${thumbFilename}`;
    }

    // Create receipt record with pending status
    const receipt = await prisma.receipt.create({
      data: {
        userId: session.user.id,
        status: 'PENDING',
        source: 'UPLOAD',
        imageUrl: `receipts/${uniqueFilename}`,
        thumbnailUrl: thumbnailUrl || (isImageFile(mimeType) ? `receipts/${uniqueFilename}` : null),
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
          size: fileBuffer.length,
          ...optimizationMeta,
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
