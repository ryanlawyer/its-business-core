import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext, AuditAction } from '@/lib/audit';
import { findTransactionMatches } from '@/lib/transaction-matcher';

type RouteContext = {
  params: Promise<{ id: string; transactionId: string }>;
};

/**
 * GET /api/statements/[id]/transactions/[transactionId]
 * Get a single transaction with match suggestions
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id, transactionId } = await context.params;

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

    // Verify transaction exists and belongs to the statement
    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: transactionId,
        statementId: id,
      },
      include: {
        statement: {
          select: { userId: true },
        },
        matchedReceipt: {
          select: {
            id: true,
            merchantName: true,
            totalAmount: true,
            receiptDate: true,
            imageUrl: true,
          },
        },
        matchedPurchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            poDate: true,
            vendor: { select: { name: true } },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (!canViewAll && transaction.statement.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get match suggestions if not already matched
    let suggestions = null;
    if (!transaction.matchedReceiptId && !transaction.matchedPurchaseOrderId && !transaction.noReceiptRequired) {
      const matchResult = await findTransactionMatches(transactionId, { maxResults: 10 });
      suggestions = matchResult.allMatches;
    }

    return NextResponse.json({
      transaction,
      suggestions,
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/statements/[id]/transactions/[transactionId]
 * Update transaction (match, unmatch, or mark no-receipt)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id, transactionId } = await context.params;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Check edit permission
    if (!hasPermission(permissions, 'reports', 'canEdit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify transaction exists and belongs to the statement
    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: transactionId,
        statementId: id,
      },
      include: {
        statement: {
          select: { userId: true },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check ownership
    const canViewAll = hasPermission(permissions, 'reports', 'canViewAll');
    if (!canViewAll && transaction.statement.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, receiptId, purchaseOrderId, noReceiptRequired } = body;

    let updateData: Record<string, unknown> = {};
    let auditAction = '';
    const auditChanges: Record<string, unknown> = {
      before: {
        matchedReceiptId: transaction.matchedReceiptId,
        matchedPurchaseOrderId: transaction.matchedPurchaseOrderId,
        noReceiptRequired: transaction.noReceiptRequired,
      },
    };

    switch (action) {
      case 'match-receipt':
        if (!receiptId) {
          return NextResponse.json(
            { error: 'Receipt ID required' },
            { status: 400 }
          );
        }
        // Verify receipt exists
        const receipt = await prisma.receipt.findUnique({
          where: { id: receiptId },
          select: { id: true, merchantName: true },
        });
        if (!receipt) {
          return NextResponse.json(
            { error: 'Receipt not found' },
            { status: 404 }
          );
        }
        updateData = {
          matchedReceiptId: receiptId,
          matchedPurchaseOrderId: null,
          noReceiptRequired: false,
        };
        auditAction = 'TRANSACTION_MATCHED_RECEIPT';
        auditChanges.after = { matchedReceiptId: receiptId, receiptMerchant: receipt.merchantName };
        break;

      case 'match-po':
        if (!purchaseOrderId) {
          return NextResponse.json(
            { error: 'Purchase Order ID required' },
            { status: 400 }
          );
        }
        // Verify PO exists
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          select: { id: true, poNumber: true },
        });
        if (!po) {
          return NextResponse.json(
            { error: 'Purchase Order not found' },
            { status: 404 }
          );
        }
        updateData = {
          matchedPurchaseOrderId: purchaseOrderId,
          matchedReceiptId: null,
          noReceiptRequired: false,
        };
        auditAction = 'TRANSACTION_MATCHED_PO';
        auditChanges.after = { matchedPurchaseOrderId: purchaseOrderId, poNumber: po.poNumber };
        break;

      case 'unmatch':
        updateData = {
          matchedReceiptId: null,
          matchedPurchaseOrderId: null,
          noReceiptRequired: false,
        };
        auditAction = 'TRANSACTION_UNMATCHED';
        auditChanges.after = { matchedReceiptId: null, matchedPurchaseOrderId: null };
        break;

      case 'no-receipt':
        updateData = {
          noReceiptRequired: noReceiptRequired !== false,
          matchedReceiptId: null,
          matchedPurchaseOrderId: null,
        };
        auditAction = 'TRANSACTION_NO_RECEIPT';
        auditChanges.after = { noReceiptRequired: noReceiptRequired !== false };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: match-receipt, match-po, unmatch, or no-receipt' },
          { status: 400 }
        );
    }

    const updatedTransaction = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: updateData,
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
    });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: auditAction as AuditAction,
      entityType: 'BankTransaction',
      entityId: transactionId,
      changes: auditChanges,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
