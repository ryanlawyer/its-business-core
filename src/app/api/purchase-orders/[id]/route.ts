import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, canViewAllData, canViewDepartmentData, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext, getChanges, sanitizeData } from '@/lib/audit';

// GET /api/purchase-orders/[id] - Get a single purchase order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Fetch the purchase order
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        department: true,
        lineItems: {
          include: {
            budgetItem: {
              select: { id: true, code: true, description: true },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canViewAll = canViewAllData(permissions, 'purchaseOrders');
    const canViewDept =
      canViewDepartmentData(permissions, 'purchaseOrders') &&
      user.departmentId === purchaseOrder.departmentId;
    const canViewOwn =
      permissions.purchaseOrders?.canViewOwn &&
      user.id === purchaseOrder.requestedById;

    if (!canViewAll && !canViewDept && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-orders/[id] - Update a purchase order
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Fetch existing PO
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!existingPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check if user can edit this PO
    const canEdit = hasPermission(permissions, 'purchaseOrders', 'canEdit');
    const isOwner = existingPO.requestedById === user.id;
    const isDraft = existingPO.status === 'DRAFT';

    if (!canEdit && !(isOwner && isDraft)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow editing if PO is in DRAFT status
    if (existingPO.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only edit purchase orders in DRAFT status' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { poDate, vendorId, notes, lineItems } = body;

    // Calculate new total
    const totalAmount = lineItems.reduce(
      (sum: number, item: any) => sum + parseFloat(item.amount),
      0
    );

    // Delete existing line items and create new ones
    await prisma.poLineItem.deleteMany({
      where: { purchaseOrderId: id },
    });

    // Update PO
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        poDate: new Date(poDate),
        vendorId,
        notes: notes || null,
        totalAmount,
        lineItems: {
          create: lineItems.map((item: any) => ({
            description: item.description,
            amount: parseFloat(item.amount),
            budgetItemId: item.budgetItemId,
          })),
        },
      },
      include: {
        vendor: true,
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        department: true,
        lineItems: {
          include: {
            budgetItem: {
              select: { id: true, code: true, description: true },
            },
          },
        },
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'PO_UPDATED',
      entityType: 'PurchaseOrder',
      entityId: id,
      changes: getChanges(sanitizeData(existingPO), sanitizeData(updatedPO)),
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ purchaseOrder: updatedPO });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-orders/[id] - Delete a purchase order
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Check if user can delete POs
    if (!hasPermission(permissions, 'purchaseOrders', 'canDelete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch existing PO
    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existingPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Only allow deleting DRAFT POs
    if (existingPO.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete purchase orders in DRAFT status' },
        { status: 400 }
      );
    }

    // Delete line items first
    await prisma.poLineItem.deleteMany({
      where: { purchaseOrderId: id },
    });

    // Delete PO
    await prisma.purchaseOrder.delete({
      where: { id },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: user.id,
      action: 'PO_DELETED',
      entityType: 'PurchaseOrder',
      entityId: id,
      changes: { before: sanitizeData(existingPO) },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
