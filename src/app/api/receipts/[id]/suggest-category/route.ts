import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { suggestCategoryFromMerchant } from '@/lib/categorizer';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/receipts/[id]/suggest-category
 * Suggest a budget category for this receipt based on merchant name
 */
export async function GET(req: NextRequest, context: RouteContext) {
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

    // Check if user can view receipts
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        merchantName: true,
        budgetCategoryId: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check permission
    const isOwner = receipt.userId === user.id;
    if (!canViewAll && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If no merchant name, can't suggest
    if (!receipt.merchantName) {
      return NextResponse.json({
        suggestion: null,
        message: 'No merchant name available for category suggestion',
      });
    }

    // Get category suggestion (optionally with AI fallback)
    const useAI = req.nextUrl.searchParams.get('useAI') === 'true';
    const suggestion = await suggestCategoryFromMerchant(
      receipt.merchantName,
      user.id,
      useAI,
    );

    // Enrich with category details if we have a suggestion
    let suggestedCategory = null;
    if (suggestion.suggestedCategoryId) {
      suggestedCategory = await prisma.budgetCategory.findUnique({
        where: { id: suggestion.suggestedCategoryId },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      });
    }

    // Also fetch all active categories for the UI
    const allCategories = await prisma.budgetCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      suggestion: {
        category: suggestedCategory,
        confidence: suggestion.confidence,
        source: suggestion.source,
        alternatives: suggestion.alternatives,
      },
      allCategories,
      currentCategoryId: receipt.budgetCategoryId,
    });
  } catch (error) {
    console.error('Error suggesting category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
