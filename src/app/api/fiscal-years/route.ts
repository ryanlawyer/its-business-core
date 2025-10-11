import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { createAuditLog, getRequestContext } from '@/lib/audit';

/**
 * GET /api/fiscal-years
 * Returns all fiscal years
 */
export async function GET(req: NextRequest) {
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

    const fiscalYears = await prisma.fiscalYear.findMany({
      include: {
        closedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { year: 'desc' },
    });

    return NextResponse.json({ fiscalYears });
  } catch (error) {
    console.error('Error fetching fiscal years:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fiscal years' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fiscal-years
 * Create a new fiscal year
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    const canManage = hasPermission(
      userWithPerms.permissions,
      'budgetItems',
      'canManage'
    );

    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to create fiscal years' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { year, startDate, endDate } = body;

    // Validation
    if (!year || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Year, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Check for duplicate year
    const existing = await prisma.fiscalYear.findUnique({
      where: { year },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A fiscal year with this year already exists' },
        { status: 409 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        year,
        startDate: start,
        endDate: end,
        status: 'OPEN',
      },
    });

    // Audit log
    const { ipAddress, userAgent } = getRequestContext(req);
    await createAuditLog({
      userId: session.user.id,
      action: 'FISCAL_YEAR_CREATED',
      entityType: 'FiscalYear',
      entityId: fiscalYear.id,
      changes: {
        after: {
          year: fiscalYear.year,
          startDate: fiscalYear.startDate,
          endDate: fiscalYear.endDate,
          status: fiscalYear.status,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ fiscalYear }, { status: 201 });
  } catch (error) {
    console.error('Error creating fiscal year:', error);
    return NextResponse.json(
      { error: 'Failed to create fiscal year' },
      { status: 500 }
    );
  }
}
