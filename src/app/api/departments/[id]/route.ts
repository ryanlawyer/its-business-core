import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestContext, getChanges } from '@/lib/audit';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';

// GET /api/departments/[id] - Get single department with stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'departments', 'canView')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
        budgetItems: {
          select: {
            id: true,
            code: true,
            description: true,
            budgetAmount: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Get PO statistics for this department
    const poCount = await prisma.purchaseOrder.count({
      where: { departmentId: department.id },
    });

    const poStats = await prisma.purchaseOrder.aggregate({
      where: { departmentId: department.id },
      _sum: { totalAmount: true },
    });

    return NextResponse.json({
      department: {
        ...department,
        stats: {
          userCount: department.users.length,
          budgetItemCount: department.budgetItems.length,
          poCount,
          totalSpend: poStats._sum?.totalAmount ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department' },
      { status: 500 }
    );
  }
}

// PUT /api/departments/[id] - Update department
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = JSON.parse(user.role.permissions);
    if (!permissions.departments?.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, isActive } = body;

    // Get existing department for audit
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const updated = await prisma.department.update({
      where: { id },
      data: { name, description, isActive },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: isActive === false ? 'DEPARTMENT_DEACTIVATED' : 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: updated.id,
      changes: getChanges(existing, updated),
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ department: updated });
  } catch (error: any) {
    console.error('Error updating department:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Department name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - Delete department
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user?.role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = JSON.parse(user.role.permissions);
    if (!permissions.departments?.canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if department has users or budget items
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            budgetItems: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (department._count.users > 0 || department._count.budgetItems > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete department with assigned users or budget items',
          userCount: department._count.users,
          budgetItemCount: department._count.budgetItems,
        },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'Department',
      entityId: id,
      changes: {
        before: department,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}
