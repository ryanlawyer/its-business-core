import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { escapeCSV } from '@/lib/csv-sanitize';

type BudgetVarianceItem = {
  id: string;
  code: string;
  description: string;
  categoryName: string | null;
  categoryCode: string | null;
  departmentName: string | null;
  budgetAmount: number;
  encumbered: number;
  actualSpent: number;
  available: number;
  variance: number;
  variancePercent: number;
};

type GroupSubtotal = {
  budget: number;
  spent: number;
  encumbered: number;
  available: number;
};

/**
 * GET /api/reports/budget-variance
 * Generate budget variance report for a fiscal year
 */
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

    if (!hasPermission(permissions, 'budgetItems', 'canView')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || String(new Date().getFullYear()), 10);
    const format = searchParams.get('format') || 'json';

    if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      return NextResponse.json({ error: 'Invalid fiscal year' }, { status: 400 });
    }

    // Query all active budget items for the fiscal year
    const budgetItems = await prisma.budgetItem.findMany({
      where: { fiscalYear, isActive: true },
      include: {
        department: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, code: true } },
      },
      orderBy: { code: 'asc' },
    });

    // Calculate variance for each item
    const items: BudgetVarianceItem[] = budgetItems.map((item) => {
      const budgetAmount = item.budgetAmount;
      const encumbered = item.encumbered;
      const actualSpent = item.actualSpent;
      const available = budgetAmount - encumbered - actualSpent;
      const variance = budgetAmount - actualSpent;
      const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      return {
        id: item.id,
        code: item.code,
        description: item.description,
        categoryName: item.category?.name || null,
        categoryCode: item.category?.code || null,
        departmentName: item.department?.name || null,
        budgetAmount,
        encumbered,
        actualSpent,
        available,
        variance,
        variancePercent,
      };
    });

    // Build summary stats
    const totalBudget = items.reduce((sum, i) => sum + i.budgetAmount, 0);
    const totalSpent = items.reduce((sum, i) => sum + i.actualSpent, 0);
    const totalEncumbered = items.reduce((sum, i) => sum + i.encumbered, 0);
    const totalAvailable = totalBudget - totalSpent - totalEncumbered;

    // Group by category
    const byCategory: Record<string, GroupSubtotal> = {};
    for (const item of items) {
      const key = item.categoryName || 'Uncategorized';
      if (!byCategory[key]) {
        byCategory[key] = { budget: 0, spent: 0, encumbered: 0, available: 0 };
      }
      byCategory[key].budget += item.budgetAmount;
      byCategory[key].spent += item.actualSpent;
      byCategory[key].encumbered += item.encumbered;
      byCategory[key].available += item.available;
    }

    // Group by department
    const byDepartment: Record<string, GroupSubtotal> = {};
    for (const item of items) {
      const key = item.departmentName || 'No Department';
      if (!byDepartment[key]) {
        byDepartment[key] = { budget: 0, spent: 0, encumbered: 0, available: 0 };
      }
      byDepartment[key].budget += item.budgetAmount;
      byDepartment[key].spent += item.actualSpent;
      byDepartment[key].encumbered += item.encumbered;
      byDepartment[key].available += item.available;
    }

    // Handle CSV export
    if (format === 'csv') {
      const csv = generateCSV(fiscalYear, items);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="budget-variance-${fiscalYear}.csv"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    return NextResponse.json({
      fiscalYear,
      summary: { totalBudget, totalSpent, totalEncumbered, totalAvailable },
      items,
      byCategory,
      byDepartment,
    });
  } catch (error) {
    console.error('Error generating budget variance report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateCSV(fiscalYear: number, items: BudgetVarianceItem[]): string {
  const lines: string[] = [];

  // UTF-8 BOM prefix
  const bom = '\uFEFF';

  lines.push(`Budget Variance Report - FY ${fiscalYear}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  // Header row
  lines.push('Code,Description,Category,Department,Budget,Encumbered,Actual Spent,Available,Variance,Variance %');

  for (const item of items) {
    lines.push([
      escapeCSV(item.code),
      escapeCSV(item.description),
      escapeCSV(item.categoryName || ''),
      escapeCSV(item.departmentName || ''),
      item.budgetAmount.toFixed(2),
      item.encumbered.toFixed(2),
      item.actualSpent.toFixed(2),
      item.available.toFixed(2),
      item.variance.toFixed(2),
      item.variancePercent.toFixed(1) + '%',
    ].join(','));
  }

  return bom + lines.join('\n');
}
