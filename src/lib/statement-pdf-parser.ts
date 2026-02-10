import { getAIProvider, trackAICall } from '@/lib/ai';
import type { ParseResult, ParsedTransaction } from './statement-parser';

const SYSTEM_PROMPT = `You are a bank statement parser. Extract every transaction from this PDF bank statement.

Respond ONLY with valid JSON in this exact format:
{
  "accountName": "Account name if visible" or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description",
      "amount": 123.45,
      "type": "DEBIT" or "CREDIT"
    }
  ]
}

Rules:
- Extract ALL transaction rows from the statement
- Dates must be in YYYY-MM-DD format
- Amounts must be positive numbers without currency symbols
- Type is DEBIT for money out (withdrawals, payments, fees) and CREDIT for money in (deposits, refunds)
- If a single amount column uses negative for debits, convert to positive and set type to DEBIT
- Include the account name or number if visible on the statement
- Do not include balance entries, headers, or summary rows — only actual transactions
- Do not include any text outside the JSON object`;

const USER_PROMPT = 'Extract all transactions from this bank statement PDF and return them as JSON.';

interface AITransaction {
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
}

interface AIStatementResponse {
  accountName?: string | null;
  transactions: AITransaction[];
}

/**
 * Parse a PDF bank statement using AI vision
 */
export async function parsePdfStatement(
  buffer: Buffer,
  userId?: string,
): Promise<ParseResult> {
  try {
    const provider = await getAIProvider();
    const base64 = buffer.toString('base64');

    const aiResponse = await trackAICall(
      { taskType: 'ocr', userId, entityType: 'BankStatement' },
      () =>
        provider.vision({
          system: SYSTEM_PROMPT,
          prompt: USER_PROMPT,
          imageData: base64,
          mediaType: 'application/pdf',
          maxTokens: 4096,
        }),
    );

    // Parse JSON response
    let jsonText = aiResponse.text.trim();

    // Extract JSON if wrapped in markdown code blocks
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const result: AIStatementResponse = JSON.parse(jsonText);

    if (!Array.isArray(result.transactions) || result.transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        error: 'No transactions found in PDF statement',
      };
    }

    // Map AI response to ParsedTransaction format
    const transactions: ParsedTransaction[] = [];
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    for (const t of result.transactions) {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) continue;

      const amount = Math.abs(t.amount);
      if (amount === 0) continue;

      const type = t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT';

      transactions.push({
        date,
        description: (t.description || '').trim(),
        amount,
        type,
      });

      if (!startDate || date < startDate) startDate = date;
      if (!endDate || date > endDate) endDate = date;
    }

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        error: 'No valid transactions could be parsed from PDF statement',
      };
    }

    // Sort by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      success: true,
      transactions,
      detectedFormat: 'PDF (AI-extracted)',
      startDate,
      endDate,
    };
  } catch (error) {
    console.error('Error parsing PDF statement:', error);
    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Failed to parse PDF statement',
    };
  }
}
