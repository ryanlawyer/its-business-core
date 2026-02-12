import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, canViewAllData, canViewDepartmentData } from '@/lib/check-permissions';
import { scoreReceiptVsPO_remaining } from '@/lib/receipt-po-matcher';

/**
 * GET /api/purchase-orders/[id]/suggest-receipts
 * Suggest unlinked receipts that might match this purchase order.
 * Scores receipts against the remaining unreceipted amount.
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

    // Fetch the PO with linked receipts
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true } },
        receipts: {
          select: { id: true, totalAmount: true },
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

    // Calculate already-receipted amount
    const receiptedSoFar = purchaseOrder.receipts.reduce(
      (sum, r) => sum + (r.totalAmount || 0),
      0
    );

    // Parse optional query filters
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause for unlinked receipts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      purchaseOrderId: null,
    };

    if (search) {
      whereClause.merchantName = { contains: search };
    }

    if (minAmount || maxAmount) {
      whereClause.totalAmount = {};
      if (minAmount) whereClause.totalAmount.gte = parseFloat(minAmount);
      if (maxAmount) whereClause.totalAmount.lte = parseFloat(maxAmount);
    }

    if (startDate || endDate) {
      whereClause.receiptDate = {};
      if (startDate) whereClause.receiptDate.gte = new Date(startDate);
      if (endDate) whereClause.receiptDate.lte = new Date(endDate);
    }

    const receipts = await prisma.receipt.findMany({
      where: whereClause,
      select: {
        id: true,
        merchantName: true,
        totalAmount: true,
        receiptDate: true,
        vendorId: true,
        thumbnailUrl: true,
        status: true,
        currency: true,
      },
      orderBy: { receiptDate: 'desc' },
      take: 50,
    });

    // Score each receipt against the PO
    const scored = receipts
      .map((receipt) => {
        const match = scoreReceiptVsPO_remaining(
          receipt,
          purchaseOrder,
          receiptedSoFar
        );
        return {
          receipt: {
            id: receipt.id,
            merchantName: receipt.merchantName,
            totalAmount: receipt.totalAmount,
            receiptDate: receipt.receiptDate,
            thumbnailUrl: receipt.thumbnailUrl,
            status: receipt.status,
            currency: receipt.currency,
          },
          matchScore: match.score,
          matchReasons: match.reasons,
        };
      })
      .filter((s) => s.matchReasons.length > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    return NextResponse.json({
      suggestions: scored,
      receiptedSoFar,
    });
  } catch (error) {
    console.error('Error suggesting receipts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
