import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { learnMerchantCategory } from '@/lib/categorizer';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/receipts/[id]/category
 * Assign a budget category to a receipt and optionally learn the mapping
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
    const { categoryId, learnMapping = true } = body;

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    // Verify the category exists
    const category = await prisma.budgetCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, code: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantName: true,
        budgetCategoryId: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    const previousCategoryId = receipt.budgetCategoryId;

    // Update the receipt
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: { budgetCategoryId: categoryId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true } },
        budgetCategory: { select: { id: true, name: true, code: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        lineItems: true,
      },
    });

    // Learn the mapping if requested and merchant name exists
    if (learnMapping && receipt.merchantName) {
      await learnMerchantCategory(user.id, receipt.merchantName, categoryId);
    }

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'RECEIPT_CATEGORY_ASSIGNED',
      entityType: 'Receipt',
      entityId: id,
      changes: {
        before: { budgetCategoryId: previousCategoryId },
        after: {
          budgetCategoryId: categoryId,
          categoryName: category.name,
          learnedMapping: learnMapping && receipt.merchantName ? true : false,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      receipt: updatedReceipt,
      message: `Category assigned${learnMapping && receipt.merchantName ? ' and mapping learned' : ''}`,
    });
  } catch (error) {
    console.error('Error assigning category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/receipts/[id]/category
 * Remove the category from a receipt
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

    // Check if user can edit receipts
    if (!hasPermission(permissions, 'receipts', 'canEdit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        budgetCategoryId: true,
        budgetCategory: { select: { name: true } },
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    if (!receipt.budgetCategoryId) {
      return NextResponse.json(
        { error: 'Receipt does not have a category assigned' },
        { status: 400 }
      );
    }

    const previousCategory = receipt.budgetCategory?.name;

    // Remove the category
    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: { budgetCategoryId: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'RECEIPT_CATEGORY_REMOVED',
      entityType: 'Receipt',
      entityId: id,
      changes: {
        before: {
          budgetCategoryId: receipt.budgetCategoryId,
          categoryName: previousCategory,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      receipt: updatedReceipt,
      message: 'Category removed from receipt',
    });
  } catch (error) {
    console.error('Error removing category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
