import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { scoreReceiptVsPO } from '@/lib/receipt-po-matcher';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/receipts/[id]/suggest-po
 * Suggest purchase orders that might match this receipt
 * Based on vendor, amount, and date
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

    // Check if user can view receipts
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantName: true,
        totalAmount: true,
        receiptDate: true,
        vendorId: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check permission
    const isOwner = receipt.userId === user.id;
    if (!canViewAll && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query params for PO search
    const poWhereClause: any = {
      status: {
        in: ['APPROVED', 'COMPLETED'],
      },
    };

    // If receipt has a vendor, prefer POs from the same vendor
    if (receipt.vendorId) {
      poWhereClause.vendorId = receipt.vendorId;
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: poWhereClause,
      include: {
        vendor: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        receipts: { select: { id: true } },
      },
      orderBy: { poDate: 'desc' },
      take: 20,
    });

    // Score each PO using shared utility
    const suggestions: Array<{
      purchaseOrder: any;
      matchScore: number;
      matchReasons: string[];
    }> = [];

    for (const po of purchaseOrders) {
      const match = scoreReceiptVsPO(receipt, po);

      if (match.reasons.length > 0) {
        suggestions.push({
          purchaseOrder: {
            id: po.id,
            poNumber: po.poNumber,
            poDate: po.poDate,
            totalAmount: po.totalAmount,
            status: po.status,
            vendor: po.vendor,
            requestedBy: po.requestedBy,
            linkedReceiptCount: po.receipts.length,
          },
          matchScore: match.score,
          matchReasons: match.reasons,
        });
      }
    }

    // Sort by match score
    suggestions.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 5 suggestions
    return NextResponse.json({
      suggestions: suggestions.slice(0, 5),
    });
  } catch (error) {
    console.error('Error suggesting POs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
