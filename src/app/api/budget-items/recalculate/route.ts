import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { recalculateAllBudgets } from '@/lib/budget-tracking';

/**
 * POST /api/budget-items/recalculate
 * Recalculates encumbered and actualSpent for all budget items
 * based on current PO statuses
 */
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

    // Only admins or budget managers can recalculate
    if (!hasPermission(permissions, 'budgetItems', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('Starting budget recalculation...');
    const result = await recalculateAllBudgets();
    console.log('Budget recalculation complete:', result);

    return NextResponse.json({
      success: true,
      message: 'Budget items recalculated successfully',
      ...result,
    });
  } catch (error) {
    console.error('Error recalculating budgets:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate budgets' },
      { status: 500 }
    );
  }
}
