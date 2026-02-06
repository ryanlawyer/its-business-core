import { prisma } from './prisma';
import { PrismaClient, POStatus } from '@prisma/client';

type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
type PrismaLike = PrismaClient | PrismaTransactionClient;

/**
 * Update budget item encumbered and actualSpent amounts based on PO status
 * This is called whenever a PO status changes.
 * Accepts an optional transaction client (tx) for transactional consistency.
 */
export async function updateBudgetFromPO(
  purchaseOrderId: string,
  oldStatus: POStatus | null,
  newStatus: POStatus,
  tx?: PrismaTransactionClient
) {
  const db: PrismaLike = tx || prisma;

  // Get the PO with line items
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      lineItems: {
        include: {
          budgetItem: true,
        },
      },
    },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  // Group line items by budget item
  const budgetItemGroups = new Map<string, number>();
  for (const lineItem of po.lineItems) {
    const currentAmount = budgetItemGroups.get(lineItem.budgetItemId) || 0;
    budgetItemGroups.set(lineItem.budgetItemId, currentAmount + lineItem.amount);
  }

  // Update each affected budget item
  for (const [budgetItemId, amount] of budgetItemGroups.entries()) {
    await updateBudgetItem(db, budgetItemId, amount, oldStatus, newStatus);
  }
}

/**
 * Update a single budget item's encumbered and actualSpent based on status change
 * Uses atomic increment/decrement operations to prevent read-then-write race conditions
 */
async function updateBudgetItem(
  db: PrismaLike,
  budgetItemId: string,
  amount: number,
  oldStatus: POStatus | null,
  newStatus: POStatus
) {
  let encumberedDelta = 0;
  let actualSpentDelta = 0;

  // Calculate changes based on status transition
  if (oldStatus === null) {
    // New PO being created
    if (newStatus === 'APPROVED') {
      encumberedDelta = amount;
    } else if (newStatus === 'COMPLETED') {
      actualSpentDelta = amount;
    }
  } else {
    // Status change on existing PO
    // First, remove the effect of the old status
    if (oldStatus === 'APPROVED') {
      encumberedDelta -= amount;
    } else if (oldStatus === 'COMPLETED') {
      actualSpentDelta -= amount;
    }

    // Then, add the effect of the new status
    if (newStatus === 'APPROVED') {
      encumberedDelta += amount;
    } else if (newStatus === 'COMPLETED') {
      // When completing, move from encumbered to actualSpent
      encumberedDelta -= amount;
      actualSpentDelta += amount;
    } else if (newStatus === 'CANCELLED') {
      // Releasing funds - already handled by removing old status effect
    }
  }

  // Skip update if no changes
  if (encumberedDelta === 0 && actualSpentDelta === 0) {
    return;
  }

  // Use atomic increment/decrement to prevent race conditions
  await db.budgetItem.update({
    where: { id: budgetItemId },
    data: {
      encumbered: { increment: encumberedDelta },
      actualSpent: { increment: actualSpentDelta },
    },
  });
}

/**
 * Recalculate all budget item encumbered and actualSpent from scratch
 * Useful for data fixes or migrations
 */
export async function recalculateAllBudgets(fiscalYear?: number) {
  const whereClause = fiscalYear ? { fiscalYear } : {};

  // Reset all budget items
  await prisma.budgetItem.updateMany({
    where: whereClause,
    data: {
      encumbered: 0,
      actualSpent: 0,
    },
  });

  // Get all APPROVED POs
  const approvedPOs = await prisma.purchaseOrder.findMany({
    where: { status: 'APPROVED' },
    include: {
      lineItems: true,
    },
  });

  // Get all COMPLETED POs
  const completedPOs = await prisma.purchaseOrder.findMany({
    where: { status: 'COMPLETED' },
    include: {
      lineItems: true,
    },
  });

  // Aggregate amounts by budget item
  const budgetTotals = new Map<
    string,
    { encumbered: number; actualSpent: number }
  >();

  // Process APPROVED POs (encumbered)
  for (const po of approvedPOs) {
    for (const lineItem of po.lineItems) {
      const current = budgetTotals.get(lineItem.budgetItemId) || {
        encumbered: 0,
        actualSpent: 0,
      };
      current.encumbered += lineItem.amount;
      budgetTotals.set(lineItem.budgetItemId, current);
    }
  }

  // Process COMPLETED POs (actualSpent)
  for (const po of completedPOs) {
    for (const lineItem of po.lineItems) {
      const current = budgetTotals.get(lineItem.budgetItemId) || {
        encumbered: 0,
        actualSpent: 0,
      };
      current.actualSpent += lineItem.amount;
      budgetTotals.set(lineItem.budgetItemId, current);
    }
  }

  // Update all affected budget items
  for (const [budgetItemId, totals] of budgetTotals.entries()) {
    await prisma.budgetItem.update({
      where: { id: budgetItemId },
      data: {
        encumbered: totals.encumbered,
        actualSpent: totals.actualSpent,
      },
    });
  }

  return {
    budgetItemsUpdated: budgetTotals.size,
    approvedPOsProcessed: approvedPOs.length,
    completedPOsProcessed: completedPOs.length,
  };
}
