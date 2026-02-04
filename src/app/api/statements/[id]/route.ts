import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { getReconciliationSummary } from '@/lib/transaction-matcher';
import { unlink } from 'fs/promises';
import path from 'path';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/statements/[id]
 * Get a single statement with transactions and reconciliation summary
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

    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        transactions: {
          include: {
            matchedReceipt: {
              select: {
                id: true,
                merchantName: true,
                totalAmount: true,
                receiptDate: true,
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
        },
      },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      );
    }

    // Check ownership if not admin
    if (!canViewAll && statement.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get reconciliation summary
    const summary = await getReconciliationSummary(id);

    return NextResponse.json({
      statement,
      summary,
    });
  } catch (error) {
    console.error('Error fetching statement:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/statements/[id]
 * Delete a statement and all its transactions
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

    // Check delete permission
    if (!hasPermission(permissions, 'reports', 'canDelete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        filename: true,
        filePath: true,
        _count: { select: { transactions: true } },
      },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or has canViewAll permission
    const canViewAll = hasPermission(permissions, 'reports', 'canViewAll');
    if (!canViewAll && statement.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the file
    try {
      const filePath = path.join(process.cwd(), 'uploads', statement.filePath);
      await unlink(filePath);
    } catch (fileError) {
      console.error('Error deleting statement file:', fileError);
      // Continue anyway - file might not exist
    }

    // Delete the statement (cascades to transactions)
    await prisma.bankStatement.delete({
      where: { id },
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'STATEMENT_DELETED',
      entityType: 'BankStatement',
      entityId: id,
      changes: {
        filename: statement.filename,
        transactionCount: statement._count.transactions,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: 'Statement deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting statement:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
