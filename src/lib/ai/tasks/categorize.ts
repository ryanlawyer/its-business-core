import { prisma } from '@/lib/prisma';
import { getAIProvider, trackAICall } from '@/lib/ai';
import { getSettings } from '@/lib/settings';

interface AICategoryResult {
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Use AI to suggest a budget category for a merchant/receipt
 */
export async function aiCategorizeMerchant(
  merchantName: string,
  userId?: string,
  entityId?: string,
): Promise<AICategoryResult> {
  const settings = getSettings();
  if (!settings.ai?.features?.aiCategorizationEnabled) {
    throw new Error('AI categorization is not enabled');
  }

  // Fetch all active budget categories
  const categories = await prisma.budgetCategory.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });

  if (categories.length === 0) {
    return {
      categoryId: null,
      categoryCode: null,
      categoryName: null,
      confidence: 'low',
      reasoning: 'No budget categories are configured.',
    };
  }

  const categoryList = categories
    .map((c) => `- ${c.code}: ${c.name}${c.description ? ` (${c.description})` : ''}`)
    .join('\n');

  const provider = await getAIProvider();

  const response = await trackAICall(
    { taskType: 'categorize', userId, entityType: 'Receipt', entityId },
    () =>
      provider.complete({
        system: `You are a financial categorization assistant. Given a merchant name and a list of budget categories, suggest the best matching category. Respond ONLY with valid JSON.`,
        prompt: `Merchant name: "${merchantName}"

Available budget categories:
${categoryList}

Respond with JSON in this exact format:
{
  "categoryCode": "CATEGORY_CODE",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation"
}

If no category is a good match, set categoryCode to null with confidence "low".`,
        maxTokens: 256,
      }),
  );

  // Parse response
  let cleanJson = response.text.trim();
  const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleanJson = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleanJson);
    const matchedCategory = parsed.categoryCode
      ? categories.find((c) => c.code === parsed.categoryCode)
      : null;

    return {
      categoryId: matchedCategory?.id || null,
      categoryCode: matchedCategory?.code || null,
      categoryName: matchedCategory?.name || null,
      confidence: parsed.confidence || 'low',
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return {
      categoryId: null,
      categoryCode: null,
      categoryName: null,
      confidence: 'low',
      reasoning: 'Failed to parse AI response.',
    };
  }
}
