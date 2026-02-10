import { getSettings } from '@/lib/settings';
import { getAIProvider, AINotConfiguredError, trackAICall } from '@/lib/ai';

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

export interface OCRResult {
  merchantName: string | null;
  date: string | null;
  totalAmount: number | null;
  currency: string;
  taxAmount: number | null;
  lineItems: LineItem[];
  rawText?: string;
  confidence?: number;
}

export interface OCRError {
  code: string;
  message: string;
}

const SYSTEM_PROMPT = `You are a receipt OCR specialist. Extract structured data from receipt images and documents.

Your task is to analyze the receipt and extract the following information:
1. Merchant/Store name
2. Transaction date
3. Total amount
4. Currency (default to USD if not visible)
5. Tax amount (if shown)
6. Individual line items with description, quantity, unit price, and total

Respond ONLY with valid JSON in this exact format:
{
  "merchantName": "Store Name" or null,
  "date": "YYYY-MM-DD" or null,
  "totalAmount": 123.45 or null,
  "currency": "USD",
  "taxAmount": 9.99 or null,
  "lineItems": [
    {
      "description": "Item name",
      "quantity": 1,
      "unitPrice": 5.99,
      "total": 5.99
    }
  ],
  "confidence": 0.95
}

Rules:
- Dates should be in ISO format (YYYY-MM-DD)
- Amounts should be numbers without currency symbols
- If a value cannot be determined, use null
- Line items array can be empty if items can't be extracted
- Confidence is a number between 0 and 1 indicating extraction quality
- Do not include any text outside the JSON object`;

// Supported media types for images and documents
type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';

const USER_PROMPT = 'Please extract all receipt data from this image/document and return it as JSON.';

/**
 * Extract data from a receipt image or PDF using the configured AI provider
 */
export async function extractReceiptData(
  data: string,
  mediaType: SupportedMediaType,
  userId?: string,
  entityId?: string,
): Promise<OCRResult> {
  try {
    const provider = await getAIProvider();

    const aiResponse = await trackAICall(
      { taskType: 'ocr', userId, entityType: 'Receipt', entityId },
      () =>
        provider.vision({
          system: SYSTEM_PROMPT,
          prompt: USER_PROMPT,
          imageData: data,
          mediaType,
          maxTokens: 1024,
        }),
    );

    // Parse JSON response
    const jsonText = aiResponse.text.trim();

    // Try to extract JSON if wrapped in markdown code blocks
    let cleanJson = jsonText;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleanJson = jsonMatch[1].trim();
    }

    const result = JSON.parse(cleanJson);

    // Validate and normalize the result
    return {
      merchantName: result.merchantName || null,
      date: normalizeDate(result.date),
      totalAmount: typeof result.totalAmount === 'number' ? result.totalAmount : null,
      currency: result.currency || 'USD',
      taxAmount: typeof result.taxAmount === 'number' ? result.taxAmount : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lineItems: Array.isArray(result.lineItems) ? result.lineItems.map((item: any) => ({
        description: item.description || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : undefined,
        total: typeof item.total === 'number' ? item.total : 0,
      })) : [],
      confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
    };
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      throw new OCRServiceError(
        'NOT_CONFIGURED',
        'OCR service is not configured. Please configure an AI provider in Admin Settings.'
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      throw new OCRServiceError(
        'PARSE_ERROR',
        'Failed to parse OCR response as JSON'
      );
    }

    // Re-throw OCR errors
    if (error instanceof OCRServiceError) {
      throw error;
    }

    throw new OCRServiceError(
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'Unknown OCR error'
    );
  }
}

/**
 * Extract data from a receipt file on disk
 */
export async function extractReceiptDataFromFile(
  filePath: string,
  mimeType: string,
  userId?: string,
  entityId?: string,
): Promise<OCRResult> {
  const { readFile } = await import('fs/promises');

  try {
    const buffer = await readFile(filePath);
    const base64 = buffer.toString('base64');

    let mediaType: SupportedMediaType;

    if (mimeType.includes('pdf')) {
      mediaType = 'application/pdf';
    } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      mediaType = 'image/jpeg';
    } else if (mimeType.includes('png')) {
      mediaType = 'image/png';
    } else if (mimeType.includes('gif')) {
      mediaType = 'image/gif';
    } else if (mimeType.includes('webp')) {
      mediaType = 'image/webp';
    } else {
      throw new OCRServiceError(
        'UNSUPPORTED_TYPE',
        `Unsupported file type: ${mimeType}`
      );
    }

    return extractReceiptData(base64, mediaType, userId, entityId);
  } catch (error) {
    if (error instanceof OCRServiceError) {
      throw error;
    }

    throw new OCRServiceError(
      'FILE_READ_ERROR',
      error instanceof Error ? error.message : 'Failed to read file'
    );
  }
}

/**
 * Custom error class for OCR service errors
 */
export class OCRServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OCRServiceError';
    this.code = code;
  }
}

/**
 * Normalize date to ISO format
 */
function normalizeDate(date: string | null | undefined): string | null {
  if (!date) return null;

  try {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the OCR service is properly configured
 */
export function isOCRConfigured(): boolean {
  const settings = getSettings();
  if (!settings.ai || settings.ai.provider === 'none') return false;
  if (settings.ai.features && !settings.ai.features.ocrEnabled) return false;

  switch (settings.ai.provider) {
    case 'anthropic':
      return !!(settings.ai.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY);
    case 'openai':
      return !!settings.ai.openai?.apiKey;
    case 'openrouter':
      return !!settings.ai.openrouter?.apiKey;
    case 'ollama':
      return !!settings.ai.ollama?.baseUrl;
    case 'custom':
      return !!settings.ai.custom?.baseUrl;
    default:
      return false;
  }
}

/**
 * Process a receipt with retry logic
 */
export async function processReceiptWithRetry(
  filePath: string,
  mimeType: string,
  maxRetries: number = 3,
  userId?: string,
  entityId?: string,
): Promise<OCRResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extractReceiptDataFromFile(filePath, mimeType, userId, entityId);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retriable errors
      if (error instanceof OCRServiceError) {
        const nonRetriableErrors = ['UNSUPPORTED_TYPE', 'FILE_READ_ERROR', 'PARSE_ERROR', 'NOT_CONFIGURED'];
        if (nonRetriableErrors.includes(error.code)) {
          throw error;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new OCRServiceError('MAX_RETRIES', 'Maximum retry attempts exceeded');
}
