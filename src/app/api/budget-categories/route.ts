import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/budget-categories
 * Returns all budget categories (hierarchical structure)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    const userWithPerms = await getUserWithPermissions(session.user.id);
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

    // Get all categories with parent/children relationships
    const categories = await prisma.budgetCategory.findMany({
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true, isActive: true },
        },
        _count: {
          select: { budgetItems: true },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching budget categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budget categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget-categories
 * Create a new budget category
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canManage = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canManageCategories'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to create budget categories' },
        { status: 403 }
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

    // Check for duplicate code
    const existing = await prisma.budgetCategory.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this code already exists' },
        { status: 409 }
      );
    }

    // Validate parent exists if provided
    if (parentId) {
      const parent = await prisma.budgetCategory.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        );
      }
    }

    const category = await prisma.budgetCategory.create({
      data: {
        code: code.toUpperCase(),
        name,
        description: description || null,
        parentId: parentId || null,
        glAccountCode: glAccountCode || null,
        isActive: isActive !== undefined ? isActive : true,
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
      action: 'BUDGET_CATEGORY_CREATED',
      entityType: 'BudgetCategory',
      entityId: category.id,
      changes: {
        after: {
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

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Error creating budget category:', error);
    return NextResponse.json(
      { error: 'Failed to create budget category' },
      { status: 500 }
    );
  }
}
