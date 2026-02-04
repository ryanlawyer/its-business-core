import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { autoMatchStatementTransactions } from '@/lib/transaction-matcher';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/statements/[id]/auto-match
 * Automatically match transactions to receipts/POs
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

    // Check edit permission
    if (!hasPermission(permissions, 'reports', 'canEdit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify statement exists
    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        filename: true,
      },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      );
    }

    // Check ownership
    const canViewAll = hasPermission(permissions, 'reports', 'canViewAll');
    if (!canViewAll && statement.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse optional config from request body
    let minConfidence = 70;
    try {
      const body = await req.json();
      if (body.minConfidence) {
        minConfidence = parseInt(body.minConfidence);
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Run auto-matching
    const result = await autoMatchStatementTransactions(id, { minConfidence });

    // Create audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'STATEMENT_AUTO_MATCHED',
      entityType: 'BankStatement',
      entityId: id,
      changes: {
        matched: result.matched,
        unmatched: result.unmatched,
        minConfidence,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      matched: result.matched,
      unmatched: result.unmatched,
      details: result.results.map((r) => ({
        transactionId: r.transactionId,
        bestMatch: r.bestMatch
          ? {
              receiptId: r.bestMatch.receiptId,
              purchaseOrderId: r.bestMatch.purchaseOrderId,
              score: r.bestMatch.matchScore,
              reasons: r.bestMatch.matchReasons,
            }
          : null,
        alternativeCount: r.allMatches.length - 1,
      })),
    });
  } catch (error) {
    console.error('Error auto-matching statement:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
