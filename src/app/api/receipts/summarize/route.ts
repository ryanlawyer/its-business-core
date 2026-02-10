import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { summarizeExpenses } from '@/lib/ai/tasks/summarize';

/**
 * POST /api/receipts/summarize
 * Generate an AI summary of selected receipts
 * Body: { receiptIds?: string[], dateFrom?: string, dateTo?: string }
 */
export async function POST(req: NextRequest) {
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
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { receiptIds, dateFrom, dateTo } = body;

    // Build query filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: 'COMPLETED',
    };

    if (!canViewAll) {
      where.userId = session.user.id;
    }

    if (receiptIds && Array.isArray(receiptIds) && receiptIds.length > 0) {
      where.id = { in: receiptIds };
    }

    if (dateFrom || dateTo) {
      where.receiptDate = {};
      if (dateFrom) where.receiptDate.gte = new Date(dateFrom);
      if (dateTo) where.receiptDate.lte = new Date(dateTo);
    }

    const receipts = await prisma.receipt.findMany({
      where,
      select: {
        merchantName: true,
        totalAmount: true,
        currency: true,
        receiptDate: true,
        budgetCategory: { select: { name: true } },
      },
      orderBy: { receiptDate: 'desc' },
      take: 100, // Limit to prevent huge prompts
    });

    if (receipts.length === 0) {
      return NextResponse.json({ error: 'No receipts found matching criteria' }, { status: 404 });
    }

    const receiptData = receipts.map((r) => ({
      merchantName: r.merchantName,
      totalAmount: r.totalAmount,
      currency: r.currency,
      receiptDate: r.receiptDate?.toISOString().split('T')[0] || null,
      categoryName: r.budgetCategory?.name || null,
    }));

    const result = await summarizeExpenses(receiptData, session.user.id);

    return NextResponse.json({ summary: result });
  } catch (error) {
    console.error('Error generating expense summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
