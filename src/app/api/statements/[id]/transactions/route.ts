import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/statements/[id]/transactions
 * List transactions for a statement with optional filters
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

    // Check permissions
    const canViewAll = hasPermission(permissions, 'reports', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'reports', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify statement exists and user has access
    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      );
    }

    if (!canViewAll && statement.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // matched, unmatched, no-receipt
    const type = searchParams.get('type'); // DEBIT, CREDIT
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      statementId: id,
    };

    if (status === 'matched') {
      where.OR = [
        { matchedReceiptId: { not: null } },
        { matchedPurchaseOrderId: { not: null } },
      ];
    } else if (status === 'unmatched') {
      where.matchedReceiptId = null;
      where.matchedPurchaseOrderId = null;
      where.noReceiptRequired = false;
    } else if (status === 'no-receipt') {
      where.noReceiptRequired = true;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: {
          matchedReceipt: {
            select: {
              id: true,
              merchantName: true,
              totalAmount: true,
              receiptDate: true,
              imagePath: true,
            },
          },
          matchedPurchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              totalAmount: true,
              vendor: { select: { name: true } },
            },
          },
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
