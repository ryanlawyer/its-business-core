import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

export async function POST(req: NextRequest) {
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

    // Check if user can manage budget categories (admin permission)
    const canManage = hasPermission(permissions, 'budgetItems', 'canManageCategories');

    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { sourceFiscalYear, targetFiscalYear } = body;

    if (!sourceFiscalYear || !targetFiscalYear) {
      return NextResponse.json(
        { error: 'Source and target fiscal years are required' },
        { status: 400 }
      );
    }

    if (sourceFiscalYear === targetFiscalYear) {
      return NextResponse.json(
        { error: 'Source and target years must be different' },
        { status: 400 }
      );
    }

    // Check if source year has budget items
    const sourceItems = await prisma.budgetItem.findMany({
      where: { fiscalYear: sourceFiscalYear },
      include: {
        category: true,
      },
    });

    if (sourceItems.length === 0) {
      return NextResponse.json(
        { error: `No budget items found for fiscal year ${sourceFiscalYear}` },
        { status: 404 }
      );
    }

    // Check if target year already has budget items
    const existingTargetItems = await prisma.budgetItem.findMany({
      where: { fiscalYear: targetFiscalYear },
    });

    if (existingTargetItems.length > 0) {
      return NextResponse.json(
        {
          error: `Target fiscal year ${targetFiscalYear} already has ${existingTargetItems.length} budget items. Delete them first or choose a different year.`,
        },
        { status: 409 }
      );
    }

    // Copy budget items to new year
    const copiedItems = await prisma.$transaction(async (tx) => {
      const newItems = [];

      for (const sourceItem of sourceItems) {
        const newItem = await tx.budgetItem.create({
          data: {
            code: sourceItem.code,
            description: sourceItem.description,
            budgetAmount: sourceItem.budgetAmount,
            fiscalYear: targetFiscalYear,
            departmentId: sourceItem.departmentId,
            categoryId: sourceItem.categoryId,
            glAccountCode: sourceItem.glAccountCode,
            encumbered: 0, // Reset encumbered to 0
            actualSpent: 0, // Reset actual spent to 0
          },
        });

        newItems.push(newItem);

        // Create audit log for each copied item
        const { ipAddress, userAgent } = getRequestContext(req);
        await createAuditLog({
          userId: user.id,
          action: 'BUDGET_ITEM_COPIED',
          entityType: 'BudgetItem',
          entityId: newItem.id,
          changes: {
            sourceFiscalYear,
            targetFiscalYear,
            sourceItemId: sourceItem.id,
            code: newItem.code,
            budgetAmount: newItem.budgetAmount,
          },
          ipAddress,
          userAgent,
        });
      }

      return newItems;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully copied ${copiedItems.length} budget items from ${sourceFiscalYear} to ${targetFiscalYear}`,
      itemCount: copiedItems.length,
    });
  } catch (error) {
    console.error('Error copying budget year:', error);
    return NextResponse.json(
      { error: 'Failed to copy budget year' },
      { status: 500 }
    );
  }
}
