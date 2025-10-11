import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { cache, CacheKeys } from '@/lib/cache';

/**
 * Calculate accrued budget amount based on fiscal year progress
 */
function calculateAccruedAmount(
  totalBudget: number,
  accrualType: string,
  fiscalYear: number
): number {
  if (accrualType === 'ANNUAL') {
    // Annual accrual: full budget available immediately
    return totalBudget;
  }

  // Get fiscal year start date from settings (default to January 1)
  // TODO: Read from system settings when fiscal year management is implemented
  const fiscalYearStart = new Date(fiscalYear, 0, 1); // January 1
  const fiscalYearEnd = new Date(fiscalYear, 11, 31, 23, 59, 59); // December 31

  const now = new Date();

  // If we're before the fiscal year, nothing is accrued
  if (now < fiscalYearStart) {
    return 0;
  }

  // If we're after the fiscal year, everything is accrued
  if (now > fiscalYearEnd) {
    return totalBudget;
  }

  // Calculate progress through fiscal year
  const totalDuration = fiscalYearEnd.getTime() - fiscalYearStart.getTime();
  const elapsed = now.getTime() - fiscalYearStart.getTime();
  const progress = elapsed / totalDuration;

  if (accrualType === 'MONTHLY') {
    // Monthly accrual: proportional to months elapsed
    const monthsInYear = 12;
    const monthsElapsed = Math.floor(progress * monthsInYear);
    return (totalBudget / monthsInYear) * (monthsElapsed + 1); // +1 for current month
  } else if (accrualType === 'QUARTERLY') {
    // Quarterly accrual: proportional to quarters elapsed
    const quartersInYear = 4;
    const quartersElapsed = Math.floor(progress * quartersInYear);
    return (totalBudget / quartersInYear) * (quartersElapsed + 1); // +1 for current quarter
  }

  // Default to annual if unknown type
  return totalBudget;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { permissions } = userWithPerms;

    // Check if user can view budget items
    if (!hasPermission(permissions, 'budgetItems', 'canView')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search');
    const departmentId = searchParams.get('departmentId');
    const fiscalYear = searchParams.get('fiscalYear');

    // Build where clause
    const whereClause: any = {
      isActive: true,
    };

    if (search) {
      whereClause.OR = [
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    if (fiscalYear) {
      whereClause.fiscalYear = parseInt(fiscalYear);
    }

    // Get total count for pagination
    const total = await prisma.budgetItem.count({ where: whereClause });

    // Fetch paginated items
    const items = await prisma.budgetItem.findMany({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate accrued amounts and availability for each budget item
    const itemsWithCalculations = items.map((item) => {
      // Calculate accrued amount based on fiscal year progress
      const accruedAmount = calculateAccruedAmount(
        item.budgetAmount,
        item.accrualType,
        item.fiscalYear
      );

      // Available = Accrued - Encumbered - ActualSpent
      const available = Math.max(0, accruedAmount - item.encumbered - item.actualSpent);

      // Remaining = Total Budget - Encumbered - ActualSpent
      const remaining = item.budgetAmount - item.encumbered - item.actualSpent;

      return {
        ...item,
        accruedAmount,
        encumbered: item.encumbered,
        actualSpent: item.actualSpent,
        available,
        remaining,
        // Legacy field for compatibility
        spent: item.actualSpent,
      };
    });

    return NextResponse.json({
      items: itemsWithCalculations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching budget items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { permissions } = userWithPerms;

    // Check if user can manage budget items
    if (!hasPermission(permissions, 'budgetItems', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { code, description, budgetAmount, departmentId, fiscalYear, accrualType } = body;

    if (!code || budgetAmount === undefined) {
      return NextResponse.json(
        { error: 'Code and budget amount are required' },
        { status: 400 }
      );
    }

    // Validate accrual type
    const validAccrualTypes = ['ANNUAL', 'MONTHLY', 'QUARTERLY'];
    const finalAccrualType = accrualType && validAccrualTypes.includes(accrualType)
      ? accrualType
      : 'ANNUAL';

    const item = await prisma.budgetItem.create({
      data: {
        code,
        description: description || null,
        budgetAmount: parseFloat(budgetAmount),
        departmentId: departmentId || null,
        fiscalYear: fiscalYear || new Date().getFullYear(),
        accrualType: finalAccrualType,
      },
    });

    // Invalidate cache when budget item is created
    cache.delete(CacheKeys.budgetItems());
    cache.delete(CacheKeys.formData());

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error creating budget item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
