import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { processReceiptWithRetry, OCRServiceError, isOCRConfigured } from '@/lib/ocr';
import { resolveUploadPath } from '@/lib/file-utils';
import { existsSync } from 'fs';
import { fileTypeFromFile } from 'file-type';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/receipts/[id]/retry-ocr
 * Retry OCR processing for a FAILED receipt.
 * Deletes existing line items and reprocesses from scratch.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id: receiptId } = await context.params;

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

    // Check if user can process receipts
    if (!hasPermission(permissions, 'receipts', 'canProcess')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if OCR is configured
    if (!isOCRConfigured()) {
      return NextResponse.json(
        { error: 'OCR service is not configured. Please contact an administrator.' },
        { status: 503 }
      );
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      select: {
        id: true,
        status: true,
        imageUrl: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Only allow retry on FAILED receipts
    if (receipt.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed receipts can be retried' },
        { status: 400 }
      );
    }

    if (!receipt.imageUrl) {
      return NextResponse.json(
        { error: 'Receipt has no image to process' },
        { status: 400 }
      );
    }

    const resolvedImagePath = resolveUploadPath(receipt.imageUrl);
    if (!resolvedImagePath || !existsSync(resolvedImagePath)) {
      return NextResponse.json(
        { error: 'Receipt image file not found on disk' },
        { status: 404 }
      );
    }

    // Delete existing line items for a clean slate
    await prisma.receiptLineItem.deleteMany({
      where: { receiptId },
    });

    // Update status to processing
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { status: 'PROCESSING' },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_OCR_STARTED',
      entityType: 'Receipt',
      entityId: receiptId,
      ipAddress,
      userAgent,
    });

    // Detect file type
    const fileType = await fileTypeFromFile(resolvedImagePath);
    const mimeType = fileType?.mime || 'image/jpeg';

    // Process with OCR
    try {
      const ocrResult = await processReceiptWithRetry(resolvedImagePath, mimeType, 3, session.user.id, receiptId);

      // Update receipt with extracted data
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          status: 'COMPLETED',
          merchantName: ocrResult.merchantName,
          receiptDate: ocrResult.date ? new Date(ocrResult.date) : null,
          totalAmount: ocrResult.totalAmount,
          currency: ocrResult.currency,
          taxAmount: ocrResult.taxAmount,
          rawOcrData: JSON.stringify(ocrResult),
        },
      });

      // Create line items if extracted
      if (ocrResult.lineItems.length > 0) {
        await prisma.receiptLineItem.createMany({
          data: ocrResult.lineItems.map(item => ({
            receiptId: receiptId,
            description: item.description,
            quantity: item.quantity || null,
            unitPrice: item.unitPrice || null,
            total: item.total,
          })),
        });
      }

      // Fetch updated receipt with line items
      const finalReceipt = await prisma.receipt.findUnique({
        where: { id: receiptId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          vendor: { select: { id: true, name: true } },
          budgetCategory: { select: { id: true, name: true } },
          lineItems: true,
        },
      });

      await createAuditLog({
        userId: session.user.id,
        action: 'RECEIPT_OCR_COMPLETED',
        entityType: 'Receipt',
        entityId: receiptId,
        changes: {
          after: {
            merchantName: ocrResult.merchantName,
            totalAmount: ocrResult.totalAmount,
            lineItemsCount: ocrResult.lineItems.length,
            confidence: ocrResult.confidence,
          },
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        receipt: finalReceipt,
        ocrResult: {
          confidence: ocrResult.confidence,
          lineItemsExtracted: ocrResult.lineItems.length,
        },
        message: 'Receipt reprocessed successfully',
      });
    } catch (ocrError) {
      // Mark as failed
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          status: 'FAILED',
          rawOcrData: JSON.stringify({
            error: ocrError instanceof Error ? ocrError.message : 'Unknown error',
            code: ocrError instanceof OCRServiceError ? ocrError.code : 'UNKNOWN',
          }),
        },
      });

      await createAuditLog({
        userId: session.user.id,
        action: 'RECEIPT_OCR_FAILED',
        entityType: 'Receipt',
        entityId: receiptId,
        changes: {
          after: {
            error: ocrError instanceof Error ? ocrError.message : 'Unknown error',
          },
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json(
        {
          error: 'OCR processing failed',
          details: ocrError instanceof Error ? ocrError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error retrying receipt OCR:', error);

    // Try to mark as failed
    try {
      await prisma.receipt.update({
        where: { id: receiptId },
        data: { status: 'FAILED' },
      });
    } catch (e) {
      console.error('Error marking receipt as failed:', e);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
