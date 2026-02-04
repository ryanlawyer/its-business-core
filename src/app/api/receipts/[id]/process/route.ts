import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/receipts/[id]/process
 * Trigger OCR processing for a receipt
 * Note: Full OCR implementation will be added in Phase 3
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
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

    if (!receipt.imageUrl) {
      return NextResponse.json(
        { error: 'Receipt has no image to process' },
        { status: 400 }
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
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_OCR_STARTED',
      entityType: 'Receipt',
      entityId: id,
      ipAddress,
      userAgent,
    });

    // TODO: Phase 3 - Implement actual OCR processing with Claude Vision
    // For now, just mark as completed without extracting data
    // This will be replaced with actual OCR logic

    // Simulate processing delay (remove in production)
    await new Promise(resolve => setTimeout(resolve, 100));

    // For now, mark as completed without OCR data
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        // OCR data will be populated in Phase 3
      },
      include: {
        user: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_OCR_COMPLETED',
      entityType: 'Receipt',
      entityId: id,
      changes: {
        after: { status: 'COMPLETED' },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      receipt: updatedReceipt,
      message: 'Receipt processing completed. Note: Full OCR integration pending Phase 3.',
    });
  } catch (error) {
    console.error('Error processing receipt:', error);

    // Try to mark as failed
    try {
      const { id } = await context.params;
      await prisma.receipt.update({
        where: { id },
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
