import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';
import { cache, CacheKeys } from '@/lib/cache';

/**
 * Combined endpoint for purchase order form data
 * Returns vendors and budget items in a single request
 * Cached for 5 minutes to improve performance
 * Uses session-cached permissions to avoid database queries
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use cached permissions from session (no database query needed)
    const permData = getPermissionsFromSession(session);
    if (!permData) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { permissions } = permData;

    // Check permissions for both resources
    const canViewVendors = hasPermission(permissions, 'vendors', 'canView');
    const canViewBudgetItems = hasPermission(permissions, 'budgetItems', 'canView');

    if (!canViewVendors || !canViewBudgetItems) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check cache first
    const cacheKey = CacheKeys.formData();
    const cached = cache.get<{ vendors: any[]; budgetItems: any[] }>(cacheKey);

    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch both vendors and budget items in parallel
    const [vendors, budgetItems] = await Promise.all([
      prisma.vendor.findMany({
        select: {
          id: true,
          vendorNumber: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.budgetItem.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          description: true,
          budgetAmount: true,
          encumbered: true,
          actualSpent: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          code: 'asc',
        },
      }),
    ]);

    const data = {
      vendors,
      budgetItems,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, data, 300000);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching form data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
