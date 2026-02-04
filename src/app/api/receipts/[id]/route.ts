import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext, getChanges } from '@/lib/audit';
import { convertToBaseCurrency, BASE_CURRENCY } from '@/lib/currency';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/receipts/[id]
 * Get a single receipt by ID
 */
export async function GET(req: NextRequest, context: RouteContext) {
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

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true, vendorNumber: true } },
        budgetCategory: { select: { id: true, name: true, code: true } },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalAmount: true,
            vendor: { select: { name: true } },
          },
        },
        lineItems: {
          include: {
            budgetCategory: { select: { id: true, name: true, code: true } },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        bankTransactions: {
          select: {
            id: true,
            transactionDate: true,
            description: true,
            amount: true,
            type: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');
    const isOwner = receipt.userId === user.id;

    if (!canViewAll && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ receipt });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/receipts/[id]
 * Update a receipt
 */
export async function PUT(req: NextRequest, context: RouteContext) {
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

    // Fetch existing receipt
    const existingReceipt = await prisma.receipt.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existingReceipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canEdit = hasPermission(permissions, 'receipts', 'canEdit');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');
    const isOwner = existingReceipt.userId === user.id;

    if (!canEdit && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      merchantName,
      receiptDate,
      totalAmount,
      currency,
      taxAmount,
      vendorId,
      budgetCategoryId,
      purchaseOrderId,
      notes,
      status,
      lineItems,
    } = body;

    // Build update data
    const updateData: any = {};

    if (merchantName !== undefined) updateData.merchantName = merchantName;
    if (receiptDate !== undefined) updateData.receiptDate = receiptDate ? new Date(receiptDate) : null;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount ? parseFloat(totalAmount) : null;
    if (currency !== undefined) updateData.currency = currency;
    if (taxAmount !== undefined) updateData.taxAmount = taxAmount ? parseFloat(taxAmount) : null;
    if (vendorId !== undefined) updateData.vendorId = vendorId || null;
    if (budgetCategoryId !== undefined) updateData.budgetCategoryId = budgetCategoryId || null;
    if (purchaseOrderId !== undefined) updateData.purchaseOrderId = purchaseOrderId || null;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    // Handle currency conversion to base currency
    const effectiveCurrency = currency || existingReceipt.currency;
    const effectiveAmount = totalAmount !== undefined ? parseFloat(totalAmount) : existingReceipt.totalAmount;

    if (effectiveAmount && effectiveCurrency && effectiveCurrency !== BASE_CURRENCY) {
      try {
        const { convertedAmount, rate } = await convertToBaseCurrency(effectiveAmount, effectiveCurrency);
        updateData.convertedAmount = convertedAmount;
        updateData.conversionRate = rate;
        updateData.targetCurrency = BASE_CURRENCY;
      } catch (conversionError) {
        console.error('Currency conversion failed:', conversionError);
        // Continue without conversion - not a fatal error
      }
    } else if (effectiveCurrency === BASE_CURRENCY) {
      // Clear conversion fields if currency is base currency
      updateData.convertedAmount = null;
      updateData.conversionRate = null;
      updateData.targetCurrency = null;
    }

    // Handle line items update
    if (lineItems !== undefined) {
      // Delete existing line items and create new ones
      await prisma.receiptLineItem.deleteMany({
        where: { receiptId: id },
      });

      if (lineItems.length > 0) {
        await prisma.receiptLineItem.createMany({
          data: lineItems.map((item: any) => ({
            receiptId: id,
            description: item.description,
            quantity: item.quantity ? parseFloat(item.quantity) : null,
            unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
            total: parseFloat(item.total),
            budgetCategoryId: item.budgetCategoryId || null,
          })),
        });
      }
    }

    // Update the receipt
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true, vendorNumber: true } },
        budgetCategory: { select: { id: true, name: true, code: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        lineItems: {
          include: {
            budgetCategory: { select: { id: true, name: true } },
          },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    const changes = getChanges(
      { merchantName: existingReceipt.merchantName, totalAmount: existingReceipt.totalAmount },
      { merchantName: updatedReceipt.merchantName, totalAmount: updatedReceipt.totalAmount }
    );

    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_UPDATED',
      entityType: 'Receipt',
      entityId: id,
      changes,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ receipt: updatedReceipt });
  } catch (error) {
    console.error('Error updating receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/receipts/[id]
 * Delete a receipt
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

    const { user, permissions } = userWithPerms;

    // Fetch existing receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantName: true,
        totalAmount: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canDelete = hasPermission(permissions, 'receipts', 'canDelete');
    const isOwner = receipt.userId === user.id;

    if (!canDelete && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the receipt (cascades to line items and tags)
    await prisma.receipt.delete({
      where: { id },
    });

    // Delete associated files
    if (receipt.imageUrl && existsSync(receipt.imageUrl)) {
      try {
        await unlink(receipt.imageUrl);
      } catch (e) {
        console.error('Error deleting receipt image:', e);
      }
    }

    if (receipt.thumbnailUrl && receipt.thumbnailUrl !== receipt.imageUrl && existsSync(receipt.thumbnailUrl)) {
      try {
        await unlink(receipt.thumbnailUrl);
      } catch (e) {
        console.error('Error deleting receipt thumbnail:', e);
      }
    }

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'RECEIPT_DELETED',
      entityType: 'Receipt',
      entityId: id,
      changes: {
        before: {
          merchantName: receipt.merchantName,
          totalAmount: receipt.totalAmount,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: 'Receipt deleted successfully' });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
