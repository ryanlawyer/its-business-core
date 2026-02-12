import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { POStatus } from '@prisma/client';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { updateBudgetFromPO } from '@/lib/budget-tracking';
import { getSettings } from '@/lib/settings';

/**
 * Check if a PO qualifies for auto-approval.
 * Returns { approved: true } or { approved: false, reason: string }
 */
async function checkAutoApproval(
  poId: string,
  totalAmount: number
): Promise<{ approved: boolean; reason?: string }> {
  const settings = getSettings();
  const autoApproval = settings.purchaseOrders?.autoApproval;

  if (!autoApproval?.enabled) {
    return { approved: false, reason: 'Auto-approval is disabled' };
  }

  // Check amount threshold
  if (totalAmount > autoApproval.threshold) {
    return {
      approved: false,
      reason: `Over auto-approval threshold ($${autoApproval.threshold.toFixed(2)})`,
    };
  }

  // Check budget availability for all line items
  const lineItems = await prisma.pOLineItem.findMany({
    where: { purchaseOrderId: poId },
    include: { budgetItem: true },
  });

  for (const lineItem of lineItems) {
    if (!lineItem.budgetItem) continue;

    const remaining =
      lineItem.budgetItem.budgetAmount -
      lineItem.budgetItem.encumbered -
      lineItem.budgetItem.actualSpent;

    if (lineItem.amount > remaining) {
      return {
        approved: false,
        reason: `Would exceed budget: ${lineItem.budgetItem.description} (remaining: $${remaining.toFixed(2)})`,
      };
    }
  }

  return { approved: true };
}

// POST /api/purchase-orders/[id]/status - Change PO status
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    const { id } = await params;
    const body = await req.json();
    const { newStatus, note }: { newStatus: POStatus; note?: string } = body;

    // Get current PO
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requestedBy: true,
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Validate status transition
    const validTransitions: Record<POStatus, POStatus[]> = {
      DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
      PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
      REJECTED: ['DRAFT', 'CANCELLED'],
      APPROVED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: ['CANCELLED'],
      CANCELLED: [],
    };

    if (!validTransitions[po.status].includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${po.status} to ${newStatus}` },
        { status: 400 }
      );
    }

    // Check permissions for status changes
    if (newStatus === 'PENDING_APPROVAL') {
      // Submit for approval - user must own the PO or have edit permission
      if (po.requestedById !== user.id && !hasPermission(permissions, 'purchaseOrders', 'canEdit')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (newStatus === 'APPROVED') {
      // Approve - must have approve permission
      if (!hasPermission(permissions, 'purchaseOrders', 'canApprove')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Cannot approve own purchase orders
      if (po.requestedById === session.user.id) {
        return NextResponse.json({ error: 'Cannot approve own purchase orders' }, { status: 403 });
      }
    } else if (newStatus === 'COMPLETED') {
      // Complete - must have approve permission, and must have receipt
      if (!hasPermission(permissions, 'purchaseOrders', 'canApprove')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!po.receiptFileName && !po.receiptFilePath) {
        return NextResponse.json(
          { error: 'Cannot complete PO without receipt attachment' },
          { status: 400 }
        );
      }
    } else if (newStatus === 'CANCELLED') {
      // Void - user can void own DRAFT, manager can void department, admin can void all
      if (!hasPermission(permissions, 'purchaseOrders', 'canVoid')) {
        if (po.status !== 'DRAFT' || po.requestedById !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      // Void requires a note
      if (!note) {
        return NextResponse.json(
          { error: 'Void note is required when cancelling a PO' },
          { status: 400 }
        );
      }
    } else if (newStatus === 'REJECTED') {
      // Reject - must have approve permission
      if (!hasPermission(permissions, 'purchaseOrders', 'canApprove')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Rejection requires a note
      if (!note) {
        return NextResponse.json(
          { error: 'Rejection note is required when rejecting a PO' },
          { status: 400 }
        );
      }
    } else if (newStatus === 'DRAFT' && po.status === 'REJECTED') {
      // Reopen rejected PO for revision - owner or editor can do this
      if (po.requestedById !== user.id && !hasPermission(permissions, 'purchaseOrders', 'canEdit')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
    };

    let auditAction: string = 'PO_UPDATED';

    if (newStatus === 'PENDING_APPROVAL') {
      auditAction = 'PO_SUBMITTED';

      // Check auto-approval eligibility
      const autoResult = await checkAutoApproval(id, po.totalAmount);
      if (autoResult.approved) {
        // Auto-approve: skip PENDING_APPROVAL, go directly to APPROVED
        updateData.status = 'APPROVED';
        updateData.approvedBy = user.id;
        updateData.approvedAt = new Date();
        auditAction = 'PO_AUTO_APPROVED';
      } else if (autoResult.reason && autoResult.reason !== 'Auto-approval is disabled') {
        // Store the reason for the approver to see
        updateData.autoApprovalNote = autoResult.reason;
      }
    } else if (newStatus === 'APPROVED') {
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
      auditAction = 'PO_APPROVED';
    } else if (newStatus === 'COMPLETED') {
      updateData.completedAt = new Date();
      auditAction = 'PO_COMPLETED';
    } else if (newStatus === 'CANCELLED') {
      updateData.voidedBy = user.id;
      updateData.voidedAt = new Date();
      updateData.voidNote = note;
      auditAction = 'PO_VOIDED';
    } else if (newStatus === 'REJECTED') {
      updateData.rejectedBy = user.id;
      updateData.rejectedAt = new Date();
      updateData.rejectionNote = note;
      auditAction = 'PO_REJECTED';
    } else if (newStatus === 'DRAFT' && po.status === 'REJECTED') {
      // Reopen for revision - clear rejection and auto-approval fields
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
      updateData.rejectionNote = null;
      updateData.autoApprovalNote = null;
      auditAction = 'PO_UPDATED';
    }

    // Update PO and budget tracking in a transaction for consistency
    const updated = await prisma.$transaction(async (tx) => {
      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: updateData,
      });

      // Update budget tracking (encumbered/actualSpent)
      await updateBudgetFromPO(id, po.status, updateData.status as POStatus, tx);

      return updatedPO;
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: auditAction as any,
      entityType: 'PurchaseOrder',
      entityId: id,
      changes: {
        before: { status: po.status },
        after: { status: updateData.status, note },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ purchaseOrder: updated });
  } catch (error) {
    console.error('Error changing PO status:', error);
    return NextResponse.json(
      { error: 'Failed to change PO status' },
      { status: 500 }
    );
  }
}
