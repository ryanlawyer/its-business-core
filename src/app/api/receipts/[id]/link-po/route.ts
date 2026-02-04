import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/receipts/[id]/link-po
 * Link a receipt to a purchase order
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

    const { user, permissions } = userWithPerms;

    // Check if user can edit receipts
    if (!hasPermission(permissions, 'receipts', 'canEdit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { purchaseOrderId } = body;

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        totalAmount: true,
        purchaseOrderId: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Verify the purchase order exists and check permissions
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        poNumber: true,
        totalAmount: true,
        status: true,
        vendorId: true,
        requestedById: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Optional: Warn if amounts don't match (but don't block)
    let amountWarning = null;
    if (receipt.totalAmount !== null && purchaseOrder.totalAmount !== null) {
      const difference = Math.abs(receipt.totalAmount - purchaseOrder.totalAmount);
      const threshold = 0.01; // Allow for small floating point differences
      if (difference > threshold) {
        amountWarning = `Receipt amount (${receipt.totalAmount.toFixed(2)}) differs from PO amount (${purchaseOrder.totalAmount.toFixed(2)}) by ${difference.toFixed(2)}`;
      }
    }

    // Link the receipt to the PO
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: { purchaseOrderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true } },
        budgetCategory: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        lineItems: true,
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_LINKED_TO_PO',
      entityType: 'Receipt',
      entityId: id,
      changes: {
        after: {
          purchaseOrderId,
          poNumber: purchaseOrder.poNumber,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      receipt: updatedReceipt,
      warning: amountWarning,
      message: 'Receipt linked to purchase order successfully',
    });
  } catch (error) {
    console.error('Error linking receipt to PO:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/receipts/[id]/link-po
 * Unlink a receipt from a purchase order
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
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

    // Check if user can edit receipts
    if (!hasPermission(permissions, 'receipts', 'canEdit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        purchaseOrderId: true,
        purchaseOrder: { select: { poNumber: true } },
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    if (!receipt.purchaseOrderId) {
      return NextResponse.json(
        { error: 'Receipt is not linked to a purchase order' },
        { status: 400 }
      );
    }

    const previousPoNumber = receipt.purchaseOrder?.poNumber;

    // Unlink the receipt
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: { purchaseOrderId: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true } },
        budgetCategory: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_UNLINKED_FROM_PO',
      entityType: 'Receipt',
      entityId: id,
      changes: {
        before: {
          purchaseOrderId: receipt.purchaseOrderId,
          poNumber: previousPoNumber,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      receipt: updatedReceipt,
      message: 'Receipt unlinked from purchase order successfully',
    });
  } catch (error) {
    console.error('Error unlinking receipt from PO:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
