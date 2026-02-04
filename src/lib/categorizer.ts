import { prisma } from './prisma';

/**
 * Normalize a merchant name for consistent lookups
 */
export function normalizeMerchantName(merchantName: string): string {
  return merchantName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Get category suggestions for a merchant name based on learned mappings
 */
export async function suggestCategoryFromMerchant(
  merchantName: string,
  userId?: string
): Promise<{
  suggestedCategoryId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  source: 'user_mapping' | 'global_mapping' | 'pattern' | 'none';
  alternatives: Array<{ categoryId: string; categoryName: string; matchCount: number }>;
}> {
  const normalizedName = normalizeMerchantName(merchantName);

  // 1. Check for exact user-specific mapping (highest priority)
  if (userId) {
    const userMapping = await prisma.merchantCategoryMapping.findFirst({
      where: {
        userId,
        merchantName: normalizedName,
      },
      include: {
        budgetCategory: { select: { id: true, name: true } },
      },
    });

    if (userMapping) {
      return {
        suggestedCategoryId: userMapping.budgetCategoryId,
        confidence: 'high',
        source: 'user_mapping',
        alternatives: [],
      };
    }
  }

  // 2. Check for global mappings (across all users)
  const globalMappings = await prisma.merchantCategoryMapping.groupBy({
    by: ['budgetCategoryId'],
    where: {
      merchantName: normalizedName,
    },
    _count: {
      budgetCategoryId: true,
    },
    orderBy: {
      _count: {
        budgetCategoryId: 'desc',
      },
    },
    take: 5,
  });

  if (globalMappings.length > 0) {
    const categories = await prisma.budgetCategory.findMany({
      where: {
        id: { in: globalMappings.map((m) => m.budgetCategoryId) },
      },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const alternatives = globalMappings.map((m) => ({
      categoryId: m.budgetCategoryId,
      categoryName: categoryMap.get(m.budgetCategoryId) || 'Unknown',
      matchCount: m._count.budgetCategoryId,
    }));

    const topMatch = globalMappings[0];
    const confidence =
      topMatch._count.budgetCategoryId >= 5
        ? 'high'
        : topMatch._count.budgetCategoryId >= 2
        ? 'medium'
        : 'low';

    return {
      suggestedCategoryId: topMatch.budgetCategoryId,
      confidence,
      source: 'global_mapping',
      alternatives: alternatives.slice(1), // Exclude the top match
    };
  }

  // 3. Check for partial matches (contains the merchant name)
  const partialMappings = await prisma.merchantCategoryMapping.findMany({
    where: {
      OR: [
        { merchantName: { contains: normalizedName } },
        // Check if the merchant name contains known merchant patterns
        ...(normalizedName.split(' ').length > 1
          ? normalizedName.split(' ').map((word) => ({
              merchantName: { contains: word },
            }))
          : []),
      ],
    },
    include: {
      budgetCategory: { select: { id: true, name: true } },
    },
    take: 10,
  });

  if (partialMappings.length > 0) {
    // Count by category
    const categoryCounts = new Map<string, { name: string; count: number }>();
    partialMappings.forEach((m) => {
      const existing = categoryCounts.get(m.budgetCategoryId);
      if (existing) {
        existing.count += m.useCount;
      } else {
        categoryCounts.set(m.budgetCategoryId, {
          name: m.budgetCategory.name,
          count: m.useCount,
        });
      }
    });

    const sortedCategories = Array.from(categoryCounts.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    if (sortedCategories.length > 0) {
      const [topCategoryId, topCategory] = sortedCategories[0];
      const alternatives = sortedCategories.slice(1, 4).map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        matchCount: data.count,
      }));

      return {
        suggestedCategoryId: topCategoryId,
        confidence: 'low',
        source: 'pattern',
        alternatives,
      };
    }
  }

  return {
    suggestedCategoryId: null,
    confidence: 'none',
    source: 'none',
    alternatives: [],
  };
}

/**
 * Learn/update a merchant-category mapping
 */
export async function learnMerchantCategory(
  userId: string,
  merchantName: string,
  categoryId: string
): Promise<void> {
  const normalizedName = normalizeMerchantName(merchantName);

  // Upsert the mapping
  await prisma.merchantCategoryMapping.upsert({
    where: {
      userId_merchantName: {
        userId,
        merchantName: normalizedName,
      },
    },
    update: {
      budgetCategoryId: categoryId,
      useCount: {
        increment: 1,
      },
    },
    create: {
      userId,
      merchantName: normalizedName,
      budgetCategoryId: categoryId,
      useCount: 1,
    },
  });
}

/**
 * Get all merchant mappings for a user
 */
export async function getUserMerchantMappings(
  userId: string
): Promise<
  Array<{
    id: string;
    merchantName: string;
    categoryId: string;
    categoryName: string;
    useCount: number;
  }>
> {
  const mappings = await prisma.merchantCategoryMapping.findMany({
    where: { userId },
    include: {
      budgetCategory: { select: { id: true, name: true } },
    },
    orderBy: { useCount: 'desc' },
  });

  return mappings.map((m) => ({
    id: m.id,
    merchantName: m.merchantName,
    categoryId: m.budgetCategoryId,
    categoryName: m.budgetCategory.name,
    useCount: m.useCount,
  }));
}

/**
 * Delete a merchant mapping
 */
export async function deleteMerchantMapping(
  userId: string,
  mappingId: string
): Promise<boolean> {
  const result = await prisma.merchantCategoryMapping.deleteMany({
    where: {
      id: mappingId,
      userId, // Ensure user owns this mapping
    },
  });
  return result.count > 0;
}
