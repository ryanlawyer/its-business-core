import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { validateUploadedFile, isImageFile, isPdfFile } from '@/lib/file-validation';
import { processImage } from '@/lib/image-processing';
import { convertImageToPdf, validatePdf } from '@/lib/image-to-pdf';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Rate limiting map: userId -> { count, resetAt }
 */
const rateLimits = new Map<
  string,
  { count: number; resetAt: number }
>();

const MAX_UPLOADS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or create new limit
    rateLimits.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= MAX_UPLOADS_PER_MINUTE) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * Get max file size from system settings
 */
async function getMaxFileSizeMB(): Promise<number> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'max_file_upload_size_mb' },
    });

    if (setting && setting.value) {
      const parsed = parseInt(setting.value);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error fetching max file size setting:', error);
  }

  return 10; // Default 10MB
}

/**
 * POST /api/purchase-orders/[id]/upload-receipt
 * Upload receipt for a purchase order (image or PDF)
 * Images are auto-processed and converted to PDF
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Authentication check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Permission check
    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canUpload = hasPermission(
      userWithPerms.permissions,
      'purchaseOrders',
      'canUploadReceipts'
    );

    if (!canUpload) {
      return NextResponse.json(
        { error: 'You do not have permission to upload receipts' },
        { status: 403 }
      );
    }

    // 3. Rate limiting
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    // 4. Verify PO exists and user has access
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requestedBy: true,
        department: true,
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check if user can access this PO (creator, manager, or admin)
    const canAccess =
      po.requestedById === session.user.id ||
      hasPermission(userWithPerms.permissions, 'purchaseOrders', 'canEdit') ||
      hasPermission(userWithPerms.permissions, 'purchaseOrders', 'canApprove');

    if (!canAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this purchase order' },
        { status: 403 }
      );
    }

    // 5. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 6. Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Get max file size from settings
    const maxSizeMB = await getMaxFileSizeMB();

    // 8. Validate file
    const validation = await validateUploadedFile(
      buffer,
      file.name,
      maxSizeMB
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'File validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // 9. Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const receiptsDir = path.join(uploadsDir, 'receipts');
    const tempDir = path.join(uploadsDir, 'temp');

    for (const dir of [uploadsDir, receiptsDir, tempDir]) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    let finalPdfBuffer: Buffer;
    let processingSteps: string[] = [];

    // 10. Process file based on type
    if (isImageFile(validation.mimeType!)) {
      // Image file - process and convert to PDF
      processingSteps.push('image-detected');

      // Process image (rotate, watermark, compress)
      const processed = await processImage(buffer, {
        timestamp: new Date(),
        userName: session.user.name || session.user.email || 'Unknown',
        compress: true,
        maxSizeMB: 2,
      });

      processingSteps.push(...processed.steps);

      // Convert to PDF
      finalPdfBuffer = await convertImageToPdf(processed.buffer, {
        title: `Receipt for PO ${po.poNumber}`,
        author: session.user.name || session.user.email || 'Unknown',
        subject: `Purchase Order ${po.poNumber} Receipt`,
      });

      processingSteps.push('converted-to-pdf');
    } else if (isPdfFile(validation.mimeType!)) {
      // PDF file - validate and use as-is
      const pdfValidation = await validatePdf(buffer);

      if (!pdfValidation.valid) {
        return NextResponse.json(
          { error: pdfValidation.error || 'Invalid PDF file' },
          { status: 400 }
        );
      }

      finalPdfBuffer = buffer;
      processingSteps.push('pdf-validated');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    // 11. Generate filename
    const filename = `${po.poNumber}.pdf`;
    const filepath = path.join(receiptsDir, filename);

    // 12. Delete old receipt if it exists (BEFORE writing new one)
    // Check both database record and actual file on disk
    if (po.receiptFilePath && existsSync(po.receiptFilePath)) {
      try {
        await unlink(po.receiptFilePath);
        processingSteps.push('old-receipt-deleted-from-db-path');
        console.log(`Deleted old receipt from database path: ${po.receiptFilePath}`);
      } catch (error) {
        console.error('Error deleting old receipt from database path:', error);
      }
    }

    // Also check if file exists at the target path (in case DB was cleared but file remains)
    if (existsSync(filepath)) {
      try {
        await unlink(filepath);
        processingSteps.push('old-receipt-deleted-from-target-path');
        console.log(`Deleted old receipt from target path: ${filepath}`);
      } catch (error) {
        console.error('Error deleting old receipt from target path:', error);
      }
    }

    // 13. Now save the new PDF
    await writeFile(filepath, finalPdfBuffer);
    processingSteps.push('saved-to-disk');
    console.log(`Saved new receipt to: ${filepath}`);

    // 14. Update PO record
    const updatedPo = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        receiptFileName: filename,
        receiptFilePath: filepath,
      },
    });

    // 15. Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_UPLOADED',
      entityType: 'PurchaseOrder',
      entityId: id,
      changes: {
        after: {
          poNumber: po.poNumber,
          receiptFileName: filename,
          originalFileName: file.name,
          fileSize: finalPdfBuffer.length,
          processingSteps,
        },
      },
      ipAddress,
      userAgent,
    });

    // 16. Return success response
    return NextResponse.json({
      success: true,
      receipt: {
        filename,
        size: finalPdfBuffer.length,
        poNumber: po.poNumber,
      },
      processing: {
        steps: processingSteps,
        originalSize: buffer.length,
        finalSize: finalPdfBuffer.length,
      },
    });
  } catch (error: any) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload receipt',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/purchase-orders/[id]/upload-receipt
 * Delete receipt from a purchase order
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Authentication check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check
    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canUpload = hasPermission(
      userWithPerms.permissions,
      'purchaseOrders',
      'canUploadReceipts'
    );

    if (!canUpload) {
      return NextResponse.json(
        { error: 'You do not have permission to delete receipts' },
        { status: 403 }
      );
    }

    // Verify PO exists
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Store receipt info before deletion
    const receiptFileName = po.receiptFileName;
    const receiptFilePath = po.receiptFilePath;

    // Delete file from disk if it exists
    if (receiptFilePath && existsSync(receiptFilePath)) {
      try {
        await unlink(receiptFilePath);
        console.log(`Deleted receipt file: ${receiptFilePath}`);
      } catch (error) {
        console.error(`Error deleting receipt file: ${receiptFilePath}`, error);
        // Continue anyway to clear database record
      }
    }

    // Update PO record - always clear these fields regardless of file deletion
    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        receiptFileName: null,
        receiptFilePath: null,
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_DELETED',
      entityType: 'PurchaseOrder',
      entityId: id,
      changes: {
        before: {
          receiptFileName,
          receiptFilePath,
        },
        after: {
          receiptFileName: null,
          receiptFilePath: null,
        },
      },
      ipAddress,
      userAgent,
    });

    console.log(`Receipt deleted successfully for PO ${po.poNumber}`);
    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { error: 'Failed to delete receipt' },
      { status: 500 }
    );
  }
}
