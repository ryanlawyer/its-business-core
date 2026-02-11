import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { escapeCSV } from '@/lib/csv-sanitize';

/**
 * GET /api/receipts/export
 * Export receipts as CSV with one row per line item
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { user, permissions } = userWithPerms;

    // Check permission - need either canViewAll or canViewOwn
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json(
        { error: 'You do not have permission to export receipts' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;

    // Parse query params
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendorId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    // Permission-based filtering: if user can only view own, restrict to their receipts
    if (!canViewAll) {
      whereClause.userId = user.id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    if (startDate || endDate) {
      whereClause.receiptDate = {};
      if (startDate) {
        whereClause.receiptDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.receiptDate.lte = new Date(endDate);
      }
    }

    if (search) {
      whereClause.OR = [
        { merchantName: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    if (minAmount || maxAmount) {
      whereClause.totalAmount = {};
      if (minAmount) {
        whereClause.totalAmount.gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        whereClause.totalAmount.lte = parseFloat(maxAmount);
      }
    }

    // Fetch receipts with line items
    const receipts = await prisma.receipt.findMany({
      where: whereClause,
      include: {
        lineItems: true,
        vendor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { receiptDate: 'desc' },
    });

    // Build CSV
    const escapeField = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return '';
      return escapeCSV(String(value));
    };

    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString();
    };

    const formatAmount = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined) return '';
      return amount.toFixed(2);
    };

    // CSV headers
    const headers = [
      'Receipt ID',
      'Merchant',
      'Date',
      'Status',
      'Receipt Total',
      'Tax',
      'Currency',
      'Vendor',
      'Line Item Description',
      'Qty',
      'Unit Price',
      'Line Total',
    ];

    // CSV rows - one row per line item, receipt fields repeated
    const rows: string[] = [];

    for (const receipt of receipts) {
      const receiptFields = [
        escapeField(receipt.id),
        escapeField(receipt.merchantName),
        escapeField(formatDate(receipt.receiptDate)),
        escapeField(receipt.status),
        escapeField(formatAmount(receipt.totalAmount)),
        escapeField(formatAmount(receipt.taxAmount)),
        escapeField(receipt.currency),
        escapeField(receipt.vendor?.name),
      ];

      if (receipt.lineItems.length === 0) {
        // No line items - output one row with empty line item fields
        rows.push([...receiptFields, '', '', '', ''].join(','));
      } else {
        // One row per line item
        for (const item of receipt.lineItems) {
          rows.push(
            [
              ...receiptFields,
              escapeField(item.description),
              escapeField(item.quantity != null ? String(item.quantity) : ''),
              escapeField(formatAmount(item.unitPrice)),
              escapeField(formatAmount(item.total)),
            ].join(',')
          );
        }
      }
    }

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');

    // Return CSV file
    const filename = `receipts-export-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting receipts:', error);
    return NextResponse.json(
      { error: 'Failed to export receipts' },
      { status: 500 }
    );
  }
}
