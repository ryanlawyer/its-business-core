import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/fiscal-years/[id]
 * Get a single fiscal year by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canView = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canView'
    );

    if (!canView) {
      return NextResponse.json(
        { error: 'You do not have permission to view fiscal years' },
        { status: 403 }
      );
    }

    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: params.id },
      include: {
        closedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!fiscalYear) {
      return NextResponse.json(
        { error: 'Fiscal year not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ fiscalYear });
  } catch (error) {
    console.error('Error fetching fiscal year:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fiscal year' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fiscal-years/[id]
 * Update fiscal year (primarily for closing/reopening)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const body = await req.json();
    const { status } = body;

    const existing = await prisma.fiscalYear.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Fiscal year not found' },
        { status: 404 }
      );
    }

    // Check permissions based on action
    if (status && status !== existing.status) {
      // Status change requires close permission
      const canClose = hasPermission(
        userWithPerms.permissions,
        'budgetItems',
        'canCloseFiscalYear'
      );

      if (!canClose) {
        return NextResponse.json(
          { error: 'You do not have permission to change fiscal year status' },
          { status: 403 }
        );
      }

      // Validate status transitions
      const validStatuses = ['OPEN', 'SOFT_CLOSED', 'HARD_CLOSED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }

      // Validate logical transitions
      if (existing.status === 'HARD_CLOSED' && status !== 'HARD_CLOSED') {
        return NextResponse.json(
          { error: 'Cannot reopen a hard-closed fiscal year' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};

    if (status) {
      updateData.status = status;
      // Set closed timestamp and user if closing
      if ((status === 'SOFT_CLOSED' || status === 'HARD_CLOSED') && existing.status === 'OPEN') {
        updateData.closedById = session.user.id;
        updateData.closedAt = new Date();
      }
      // Clear closed info if reopening
      if (status === 'OPEN') {
        updateData.closedById = null;
        updateData.closedAt = null;
      }
    }

    const fiscalYear = await prisma.fiscalYear.update({
      where: { id: params.id },
      data: updateData,
      include: {
        closedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: `FISCAL_YEAR_${status.replace('_', '')}`,
      entityType: 'FiscalYear',
      entityId: fiscalYear.id,
      changes: {
        before: {
          status: existing.status,
          closedById: existing.closedById,
          closedAt: existing.closedAt,
        },
        after: {
          status: fiscalYear.status,
          closedById: fiscalYear.closedById,
          closedAt: fiscalYear.closedAt,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ fiscalYear });
  } catch (error) {
    console.error('Error updating fiscal year:', error);
    return NextResponse.json(
      { error: 'Failed to update fiscal year' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fiscal-years/[id]
 * Delete a fiscal year (only if no budget items exist for it)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canClose = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canCloseFiscalYear'
    );

    if (!canClose) {
      return NextResponse.json(
        { error: 'You do not have permission to delete fiscal years' },
        { status: 403 }
      );
    }

    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: params.id },
    });

    if (!fiscalYear) {
      return NextResponse.json(
        { error: 'Fiscal year not found' },
        { status: 404 }
      );
    }

    // Check if any budget items exist for this year
    const budgetItemCount = await prisma.budgetItem.count({
      where: { fiscalYear: fiscalYear.year },
    });

    if (budgetItemCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete fiscal year with ${budgetItemCount} budget item(s)`,
        },
        { status: 409 }
      );
    }

    await prisma.fiscalYear.delete({
      where: { id: params.id },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'FISCAL_YEAR_DELETED',
      entityType: 'FiscalYear',
      entityId: fiscalYear.id,
      changes: {
        before: {
          year: fiscalYear.year,
          startDate: fiscalYear.startDate,
          endDate: fiscalYear.endDate,
          status: fiscalYear.status,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: 'Fiscal year deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting fiscal year:', error);
    return NextResponse.json(
      { error: 'Failed to delete fiscal year' },
      { status: 500 }
    );
  }
}
