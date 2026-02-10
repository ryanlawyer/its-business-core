import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { aiCategorizeMerchant } from '@/lib/ai/tasks/categorize';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/receipts/[id]/ai-categorize
 * Trigger AI-based category suggestion for a receipt
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, userId: true, merchantName: true },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const isOwner = receipt.userId === user.id;
    if (!canViewAll && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!receipt.merchantName) {
      return NextResponse.json(
        { error: 'No merchant name available for categorization' },
        { status: 400 },
      );
    }

    const result = await aiCategorizeMerchant(receipt.merchantName, session.user.id, receipt.id);

    return NextResponse.json({ suggestion: result });
  } catch (error) {
    console.error('Error in AI categorization:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
