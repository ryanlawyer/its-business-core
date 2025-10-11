import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';

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

    // Check if user can view budget reports
    const canView =
      hasPermission(permissions, 'budgetItems', 'canViewAllCategories') ||
      hasPermission(permissions, 'budgetItems', 'canExportReports');

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || new Date().getFullYear().toString());

    // Fetch all budget items for the fiscal year
    const budgetItems = await prisma.budgetItem.findMany({
      where: { fiscalYear },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate summary
    const summary = {
      totalBudget: 0,
      totalEncumbered: 0,
      totalActualSpent: 0,
      totalRemaining: 0,
      totalAvailable: 0,
    };

    const varianceData = [];
    const departmentMap = new Map();

    for (const item of budgetItems) {
      const encumbered = item.encumbered || 0;
      const actualSpent = item.actualSpent || 0;
      const remaining = item.budgetAmount - actualSpent;
      const available = item.budgetAmount - encumbered - actualSpent;

      summary.totalBudget += item.budgetAmount;
      summary.totalEncumbered += encumbered;
      summary.totalActualSpent += actualSpent;
      summary.totalRemaining += remaining;
      summary.totalAvailable += available;

      // Variance analysis
      varianceData.push({
        code: item.code,
        description: item.description || '',
        budgetAmount: item.budgetAmount,
        encumbered,
        actualSpent,
        remaining,
        variance: remaining,
        variancePercent: item.budgetAmount > 0 ? (remaining / item.budgetAmount) * 100 : 0,
      });

      // Department summary
      if (item.department) {
        const deptId = item.department.id;
        if (!departmentMap.has(deptId)) {
          departmentMap.set(deptId, {
            departmentId: deptId,
            departmentName: item.department.name,
            budgetAmount: 0,
            encumbered: 0,
            actualSpent: 0,
            remaining: 0,
            itemCount: 0,
          });
        }
        const deptSummary = departmentMap.get(deptId);
        deptSummary.budgetAmount += item.budgetAmount;
        deptSummary.encumbered += encumbered;
        deptSummary.actualSpent += actualSpent;
        deptSummary.remaining += remaining;
        deptSummary.itemCount += 1;
      }
    }

    const departments = Array.from(departmentMap.values());

    // Year-over-Year comparison
    const yoyYears = [fiscalYear - 2, fiscalYear - 1, fiscalYear];
    const yoyData = [];

    for (const year of yoyYears) {
      const yearItems = await prisma.budgetItem.findMany({
        where: { fiscalYear: year },
        select: {
          budgetAmount: true,
          actualSpent: true,
        },
      });

      const totalBudget = yearItems.reduce((sum, item) => sum + item.budgetAmount, 0);
      const totalSpent = yearItems.reduce((sum, item) => sum + (item.actualSpent || 0), 0);

      yoyData.push({
        year,
        totalBudget,
        totalSpent,
        utilizationPercent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      });
    }

    return NextResponse.json({
      summary,
      variance: varianceData,
      departments,
      yoy: yoyData,
    });
  } catch (error) {
    console.error('Error fetching budget dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
