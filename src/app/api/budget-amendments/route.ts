import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext, type AuditAction } from '@/lib/audit';
import { parsePagination } from '@/lib/validation';

/**
 * GET /api/budget-amendments
 * Returns budget amendments with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canView = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canView'
    );

    if (!canView) {
      return NextResponse.json(
        { error: 'You do not have permission to view budget amendments' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const { page, limit } = parsePagination(searchParams);
    const budgetItemId = searchParams.get('budgetItemId');
    const fiscalYear = searchParams.get('fiscalYear');
    const type = searchParams.get('type');

    const where: any = {};
    if (budgetItemId) where.budgetItemId = budgetItemId;
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
    if (type) where.type = type;

    // Get total count for pagination
    const total = await prisma.budgetAmendment.count({ where });

    const amendments = await prisma.budgetAmendment.findMany({
      where,
      include: {
        budgetItem: {
          select: { id: true, code: true, description: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        relatedAmendment: {
          select: {
            id: true,
            type: true,
            amount: true,
            budgetItem: { select: { code: true, description: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // For transfers, batch fetch all from/to budget items in a single query
    // Collect all unique budget item IDs that need to be fetched
    const budgetItemIds = new Set<string>();
    amendments.forEach((amendment) => {
      if (amendment.fromBudgetItemId) budgetItemIds.add(amendment.fromBudgetItemId);
      if (amendment.toBudgetItemId) budgetItemIds.add(amendment.toBudgetItemId);
    });

    // Single query to fetch all needed budget items
    const transferBudgetItems = budgetItemIds.size > 0
      ? await prisma.budgetItem.findMany({
          where: { id: { in: Array.from(budgetItemIds) } },
          select: { id: true, code: true, description: true },
        })
      : [];

    // Create a lookup map for O(1) access
    const budgetItemMap = new Map(
      transferBudgetItems.map((item) => [item.id, item])
    );

    // Enrich amendments with from/to budget items using the map
    const enrichedAmendments = amendments.map((amendment) => ({
      ...amendment,
      fromBudgetItem: amendment.fromBudgetItemId
        ? budgetItemMap.get(amendment.fromBudgetItemId) || null
        : null,
      toBudgetItem: amendment.toBudgetItemId
        ? budgetItemMap.get(amendment.toBudgetItemId) || null
        : null,
    }));

    return NextResponse.json({
      amendments: enrichedAmendments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching budget amendments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget amendments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget-amendments
 * Create a new budget amendment (increase, decrease, or transfer)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { type, budgetItemId, amount, reason, toBudgetItemId } = body;

    // Validate amendment type
    const validTypes = ['INCREASE', 'DECREASE', 'TRANSFER_OUT', 'TRANSFER_IN'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid amendment type' },
        { status: 400 }
      );
    }

    // Check permissions based on type
    if (type === 'TRANSFER_OUT' || type === 'TRANSFER_IN') {
      const canTransfer = hasPermission(
        userWithPerms.permissions,
        'budgetItems',
        'canTransferFunds'
      );
      if (!canTransfer) {
        return NextResponse.json(
          { error: 'You do not have permission to transfer funds' },
          { status: 403 }
        );
      }
    } else {
      const canAmend = hasPermission(
        userWithPerms.permissions,
        'budgetItems',
        'canCreateAmendments'
      );
      if (!canAmend) {
        return NextResponse.json(
          { error: 'You do not have permission to create budget amendments' },
          { status: 403 }
        );
      }
    }

    // Validation
    if (!budgetItemId || !amount || !reason) {
      return NextResponse.json(
        { error: 'Budget item, amount, and reason are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate budget item exists
    const budgetItem = await prisma.budgetItem.findUnique({
      where: { id: budgetItemId },
    });

    if (!budgetItem) {
      return NextResponse.json(
        { error: 'Budget item not found' },
        { status: 404 }
      );
    }

    // For transfers, validate destination budget item
    if ((type === 'TRANSFER_OUT' || type === 'TRANSFER_IN') && !toBudgetItemId) {
      return NextResponse.json(
        { error: 'Destination budget item is required for transfers' },
        { status: 400 }
      );
    }

    let toBudgetItem = null;
    if (toBudgetItemId) {
      toBudgetItem = await prisma.budgetItem.findUnique({
        where: { id: toBudgetItemId },
      });
      if (!toBudgetItem) {
        return NextResponse.json(
          { error: 'Destination budget item not found' },
          { status: 404 }
        );
      }
      // Validate same fiscal year
      if (budgetItem.fiscalYear !== toBudgetItem.fiscalYear) {
        return NextResponse.json(
          { error: 'Cannot transfer between different fiscal years' },
          { status: 400 }
        );
      }
    }

    // Calculate new amount
    let newAmount = budgetItem.budgetAmount;
    if (type === 'INCREASE' || type === 'TRANSFER_IN') {
      newAmount += amount;
    } else if (type === 'DECREASE' || type === 'TRANSFER_OUT') {
      newAmount -= amount;
      // Validate sufficient budget
      if (newAmount < 0) {
        return NextResponse.json(
          { error: 'Insufficient budget amount for this operation' },
          { status: 400 }
        );
      }
    }

    // Handle transfer as a transaction
    if (type === 'TRANSFER_OUT' && toBudgetItemId) {
      const result = await prisma.$transaction(async (tx) => {
        // Create TRANSFER_OUT amendment
        const transferOut = await tx.budgetAmendment.create({
          data: {
            budgetItemId,
            type: 'TRANSFER_OUT',
            amount,
            reason,
            fromBudgetItemId: budgetItemId,
            toBudgetItemId,
            createdById: session.user.id,
            fiscalYear: budgetItem.fiscalYear,
            previousAmount: budgetItem.budgetAmount,
            newAmount: budgetItem.budgetAmount - amount,
          },
        });

        // Create linked TRANSFER_IN amendment
        const transferIn = await tx.budgetAmendment.create({
          data: {
            budgetItemId: toBudgetItemId,
            type: 'TRANSFER_IN',
            amount,
            reason: `Transfer from ${budgetItem.code}: ${reason}`,
            fromBudgetItemId: budgetItemId,
            toBudgetItemId,
            relatedAmendmentId: transferOut.id,
            createdById: session.user.id,
            fiscalYear: toBudgetItem!.fiscalYear,
            previousAmount: toBudgetItem!.budgetAmount,
            newAmount: toBudgetItem!.budgetAmount + amount,
          },
        });

        // Link the amendments
        await tx.budgetAmendment.update({
          where: { id: transferOut.id },
          data: { relatedAmendmentId: transferIn.id },
        });

        // Update budget items
        await tx.budgetItem.update({
          where: { id: budgetItemId },
          data: { budgetAmount: budgetItem.budgetAmount - amount },
        });

        await tx.budgetItem.update({
          where: { id: toBudgetItemId },
          data: { budgetAmount: toBudgetItem!.budgetAmount + amount },
        });

        return { transferOut, transferIn };
      });

      // Audit log
      const { ipAddress, userAgent } = getRequestContext(req);
      await createAuditLog({
        userId: session.user.id,
        action: 'BUDGET_TRANSFER',
        entityType: 'BudgetAmendment',
        entityId: result.transferOut.id,
        changes: {
          after: {
            type: 'TRANSFER',
            amount,
            from: budgetItem.code,
            to: toBudgetItem!.code,
            reason,
          },
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        amendment: result.transferOut,
        relatedAmendment: result.transferIn,
      }, { status: 201 });
    }

    // Handle regular amendment (INCREASE/DECREASE) in a transaction
    const amendment = await prisma.$transaction(async (tx) => {
      const created = await tx.budgetAmendment.create({
        data: {
          budgetItemId,
          type,
          amount,
          reason,
          createdById: session.user.id,
          fiscalYear: budgetItem.fiscalYear,
          previousAmount: budgetItem.budgetAmount,
          newAmount,
        },
        include: {
          budgetItem: {
            select: { id: true, code: true, description: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Update budget item
      await tx.budgetItem.update({
        where: { id: budgetItemId },
        data: { budgetAmount: newAmount },
      });

      return created;
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: `BUDGET_${type}` as AuditAction,
      entityType: 'BudgetAmendment',
      entityId: amendment.id,
      changes: {
        after: {
          budgetItem: budgetItem.code,
          type,
          amount,
          previousAmount: budgetItem.budgetAmount,
          newAmount,
          reason,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ amendment }, { status: 201 });
  } catch (error) {
    console.error('Error creating budget amendment:', error);
    return NextResponse.json(
      { error: 'Failed to create budget amendment' },
      { status: 500 }
    );
  }
}
