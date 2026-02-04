import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

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

    // Build query to find matching POs
    const suggestions: Array<{
      purchaseOrder: any;
      matchScore: number;
      matchReasons: string[];
    }> = [];

    // Query params for PO search
    const poWhereClause: any = {
      // Only look for POs that aren't yet completed or are approved
      status: {
        in: ['APPROVED', 'COMPLETED'],
      },
      // Only look at POs without already linked receipts
      // (check if any receipt already linked - handled client-side for simplicity)
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

    // Score each PO
    for (const po of purchaseOrders) {
      const matchReasons: string[] = [];
      let matchScore = 0;

      // Check vendor match
      if (receipt.vendorId && po.vendorId === receipt.vendorId) {
        matchScore += 40;
        matchReasons.push('Vendor match');
      }

      // Check merchant name similarity (if no vendor linked)
      if (!receipt.vendorId && receipt.merchantName && po.vendor.name) {
        const merchantLower = receipt.merchantName.toLowerCase();
        const vendorLower = po.vendor.name.toLowerCase();
        if (
          merchantLower.includes(vendorLower) ||
          vendorLower.includes(merchantLower)
        ) {
          matchScore += 30;
          matchReasons.push('Vendor name similar to merchant');
        }
      }

      // Check amount match (within 1% tolerance)
      if (receipt.totalAmount !== null && po.totalAmount !== null) {
        const diff = Math.abs(receipt.totalAmount - po.totalAmount);
        const tolerance = Math.max(receipt.totalAmount, po.totalAmount) * 0.01;
        if (diff <= tolerance) {
          matchScore += 40;
          matchReasons.push('Amount matches');
        } else if (diff <= tolerance * 5) {
          matchScore += 20;
          matchReasons.push('Amount close');
        }
      }

      // Check date proximity (within 30 days)
      if (receipt.receiptDate && po.poDate) {
        const receiptTime = receipt.receiptDate.getTime();
        const poTime = po.poDate.getTime();
        const daysDiff = Math.abs(receiptTime - poTime) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 3) {
          matchScore += 20;
          matchReasons.push('Date within 3 days');
        } else if (daysDiff <= 7) {
          matchScore += 15;
          matchReasons.push('Date within 7 days');
        } else if (daysDiff <= 30) {
          matchScore += 10;
          matchReasons.push('Date within 30 days');
        }
      }

      // Only include if there's at least one match reason
      if (matchReasons.length > 0) {
        // Check if this PO already has linked receipts
        const hasLinkedReceipts = po.receipts.length > 0;
        if (hasLinkedReceipts) {
          matchScore -= 20; // Penalize already-linked POs
          matchReasons.push('Already has linked receipts');
        }

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
          matchScore,
          matchReasons,
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
