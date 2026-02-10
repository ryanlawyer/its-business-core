import { getAIProvider, trackAICall } from '@/lib/ai';
import { getSettings } from '@/lib/settings';

interface ReceiptData {
  merchantName: string | null;
  totalAmount: number | null;
  currency: string;
  receiptDate: string | null;
  categoryName: string | null;
}

interface ExpenseSummaryResult {
  summary: string;
  totalSpend: number;
  receiptCount: number;
  topCategories: string[];
}

/**
 * Use AI to generate a natural language summary of expenses
 */
export async function summarizeExpenses(
  receipts: ReceiptData[],
  userId?: string,
): Promise<ExpenseSummaryResult> {
  const settings = getSettings();
  if (!settings.ai?.features?.aiSummariesEnabled) {
    throw new Error('AI summaries are not enabled');
  }

  const totalSpend = receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  const receiptSummary = receipts
    .map(
      (r, i) =>
        `${i + 1}. ${r.merchantName || 'Unknown'} - ${r.currency} ${(r.totalAmount || 0).toFixed(2)}${r.receiptDate ? ` on ${r.receiptDate}` : ''}${r.categoryName ? ` [${r.categoryName}]` : ''}`,
    )
    .join('\n');

  const provider = await getAIProvider();

  const response = await trackAICall(
    { taskType: 'summarize', userId },
    () =>
      provider.complete({
        system: `You are a financial assistant that creates concise, helpful expense summaries. Respond ONLY with valid JSON.`,
        prompt: `Summarize the following ${receipts.length} expenses (total: $${totalSpend.toFixed(2)}):

${receiptSummary}

Respond with JSON:
{
  "summary": "A 2-3 sentence natural language summary of spending patterns and notable items",
  "topCategories": ["category1", "category2"]
}`,
        maxTokens: 512,
      }),
  );

  let cleanJson = response.text.trim();
  const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleanJson = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      summary: parsed.summary || '',
      totalSpend,
      receiptCount: receipts.length,
      topCategories: Array.isArray(parsed.topCategories) ? parsed.topCategories : [],
    };
  } catch {
    return {
      summary: `${receipts.length} receipts totaling $${totalSpend.toFixed(2)}.`,
      totalSpend,
      receiptCount: receipts.length,
      topCategories: [],
    };
  }
}
