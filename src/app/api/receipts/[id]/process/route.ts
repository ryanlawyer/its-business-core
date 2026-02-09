import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission, getPermissionsFromSession } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { processReceiptWithRetry, isOCRConfigured, OCRServiceError } from '@/lib/ocr';
import { resolveUploadPath } from '@/lib/file-utils';
import { existsSync } from 'fs';
import { fileTypeFromFile } from 'file-type';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Simple per-user rate limiter for OCR processing
const ocrRateLimit = new Map<string, { count: number; resetAt: number }>();
const OCR_RATE_LIMIT_MAX = 10;
const OCR_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkOcrRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = ocrRateLimit.get(userId);

  if (!entry || now >= entry.resetAt) {
    ocrRateLimit.set(userId, { count: 1, resetAt: now + OCR_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= OCR_RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * POST /api/receipts/[id]/process
 * Trigger OCR processing for a receipt using Claude Vision API
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let receiptId = id;

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

    // Rate limit OCR requests per user
    if (!checkOcrRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Too many OCR requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      select: {
        id: true,
        userId: true,
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

    // Ownership / permission check
    const perms = getPermissionsFromSession(session);
    if (!perms) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const isOwner = receipt.userId === session.user.id;
    const canViewAll = hasPermission(perms.permissions, 'receipts', 'canViewAll');
    if (!isOwner && !canViewAll) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    if (receipt.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Receipt is already being processed' },
        { status: 400 }
      );
    }

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
      const ocrResult = await processReceiptWithRetry(resolvedImagePath, mimeType);

      // Update receipt with extracted data
      const updatedReceipt = await prisma.receipt.update({
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
        include: {
          user: { select: { id: true, name: true } },
          lineItems: true,
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
        message: 'Receipt processed successfully',
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
    console.error('Error processing receipt:', error);

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
