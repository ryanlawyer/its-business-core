import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, canViewAllData, canViewDepartmentData } from '@/lib/check-permissions';

/**
 * GET /api/purchase-orders/[id]/receipt-summary
 * Returns reconciliation summary: PO total, receipted total, remaining, etc.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Check PO view permissions
    const canViewAll = canViewAllData(permissions, 'purchaseOrders');
    const canViewDept = canViewDepartmentData(permissions, 'purchaseOrders');
    const canViewOwn = permissions.purchaseOrders?.canViewOwn;

    if (!canViewAll && !canViewDept && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch PO with receipts
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        totalAmount: true,
        requestedById: true,
        departmentId: true,
        receipts: {
          select: {
            id: true,
            merchantName: true,
            totalAmount: true,
            receiptDate: true,
            thumbnailUrl: true,
            status: true,
            currency: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Permission check on this specific PO
    const isOwner = user.id === purchaseOrder.requestedById;
    const isDept =
      canViewDept && user.departmentId === purchaseOrder.departmentId;
    if (!canViewAll && !isDept && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const poTotal = purchaseOrder.totalAmount || 0;
    const receiptedTotal = purchaseOrder.receipts.reduce(
      (sum, r) => sum + (r.totalAmount || 0),
      0
    );
    const remainingAmount = poTotal - receiptedTotal;
    const percentCovered = poTotal > 0 ? Math.round((receiptedTotal / poTotal) * 100) : 0;

    return NextResponse.json({
      poTotal,
      receiptedTotal,
      remainingAmount,
      receiptCount: purchaseOrder.receipts.length,
      percentCovered,
      receipts: purchaseOrder.receipts,
    });
  } catch (error) {
    console.error('Error fetching receipt summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
