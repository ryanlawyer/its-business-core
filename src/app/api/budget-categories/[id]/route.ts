import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext, getChanges } from '@/lib/audit';

/**
 * GET /api/budget-categories/[id]
 * Get a single budget category by ID
 */
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canView = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canViewAllCategories'
    );

    if (!canView) {
      return NextResponse.json(
        { error: 'You do not have permission to view budget categories' },
        { status: 403 }
      );
    }

    const category = await prisma.budgetCategory.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true, isActive: true },
        },
        budgetItems: {
          select: { id: true, code: true, description: true, fiscalYear: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error fetching budget category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget category' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/budget-categories/[id]
 * Update a budget category
 */
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canManage = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canManageCategories'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to update budget categories' },
        { status: 403 }
      );
    }

    const existing = await prisma.budgetCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { code, name, description, parentId, glAccountCode, isActive } = body;

    // Validation
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Check for duplicate code (exclude current category)
    if (code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.budgetCategory.findUnique({
        where: { code: code.toUpperCase() },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A category with this code already exists' },
          { status: 409 }
        );
      }
    }

    // Validate parent exists and prevent circular reference
    if (parentId) {
      if (parentId === id) {
        return NextResponse.json(
          { error: 'A category cannot be its own parent' },
          { status: 400 }
        );
      }

      const parent = await prisma.budgetCategory.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        );
      }

      // Check if parent is a descendant (would create circular reference)
      let currentParent = parent;
      while (currentParent.parentId) {
        if (currentParent.parentId === id) {
          return NextResponse.json(
            { error: 'Cannot create circular reference in category hierarchy' },
            { status: 400 }
          );
        }
        const nextParent = await prisma.budgetCategory.findUnique({
          where: { id: currentParent.parentId },
        });
        if (!nextParent) break;
        currentParent = nextParent;
      }
    }

    const category = await prisma.budgetCategory.update({
      where: { id },
      data: {
        code: code.toUpperCase(),
        name,
        description: description || null,
        parentId: parentId || null,
        glAccountCode: glAccountCode || null,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'BUDGET_CATEGORY_UPDATED',
      entityType: 'BudgetCategory',
      entityId: category.id,
      changes: getChanges(
        {
          code: existing.code,
          name: existing.name,
          description: existing.description,
          parentId: existing.parentId,
          glAccountCode: existing.glAccountCode,
          isActive: existing.isActive,
        },
        {
          code: category.code,
          name: category.name,
          description: category.description,
          parentId: category.parentId,
          glAccountCode: category.glAccountCode,
          isActive: category.isActive,
        }
      ),
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error updating budget category:', error);
    return NextResponse.json(
      { error: 'Failed to update budget category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/budget-categories/[id]
 * Delete a budget category (only if no budget items are assigned)
 */
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canManage = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canManageCategories'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to delete budget categories' },
        { status: 403 }
      );
    }

    const category = await prisma.budgetCategory.findUnique({
      where: { id },
      include: {
        budgetItems: true,
        children: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Budget category not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if category has budget items
    if (category.budgetItems.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${category.budgetItems.length} assigned budget item(s)`,
        },
        { status: 409 }
      );
    }

    // Prevent deletion if category has children
    if (category.children.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${category.children.length} child categor${category.children.length === 1 ? 'y' : 'ies'}`,
        },
        { status: 409 }
      );
    }

    await prisma.budgetCategory.delete({
      where: { id },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'BUDGET_CATEGORY_DELETED',
      entityType: 'BudgetCategory',
      entityId: category.id,
      changes: {
        before: {
          code: category.code,
          name: category.name,
          description: category.description,
          parentId: category.parentId,
          glAccountCode: category.glAccountCode,
          isActive: category.isActive,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: 'Budget category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting budget category:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget category' },
      { status: 500 }
    );
  }
}
