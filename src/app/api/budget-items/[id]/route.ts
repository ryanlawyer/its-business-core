import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!hasPermission(userWithPerms.permissions, 'budgetItems', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Find the budget item
    const budgetItem = await prisma.budgetItem.findUnique({
      where: { id },
    });

    if (!budgetItem) {
      return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
    }

    if (!budgetItem.isActive) {
      return NextResponse.json({ error: 'Budget item is already deleted' }, { status: 400 });
    }

    // Check for active POs referencing this budget item
    const activePOLineItems = await prisma.pOLineItem.findMany({
      where: {
        budgetItemId: id,
        purchaseOrder: {
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        purchaseOrder: { select: { poNumber: true, status: true } },
      },
    });

    if (activePOLineItems.length > 0) {
      const poNumbers = [...new Set(activePOLineItems.map((li) => li.purchaseOrder.poNumber))];
      return NextResponse.json(
        { error: `Cannot delete: referenced by active purchase orders: ${poNumbers.join(', ')}` },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.budgetItem.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'BUDGET_ITEM_DELETED',
      entityType: 'BudgetItem',
      entityId: id,
      changes: {
        code: budgetItem.code,
        description: budgetItem.description,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
