import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from '@/lib/settings';

// Lazy-initialized Anthropic client — recreated when API key changes
let _anthropic: Anthropic | null = null;
let _lastApiKey: string | undefined;

function getAnthropicClient(): Anthropic {
  const settings = getSettings();
  const apiKey = settings.ai?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new OCRServiceError(
      'NOT_CONFIGURED',
      'OCR service is not configured. Set an Anthropic API key in Admin Settings or the ANTHROPIC_API_KEY environment variable.'
    );
  }

  // Recreate client if API key changed
  if (!_anthropic || _lastApiKey !== apiKey) {
    _anthropic = new Anthropic({ apiKey });
    _lastApiKey = apiKey;
  }
  return _anthropic;
}

function getModel(): string {
  const settings = getSettings();
  return settings.ai?.anthropic?.model || 'claude-sonnet-4-5-20250929';
}

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
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
type DocumentMediaType = 'application/pdf';
type SupportedMediaType = ImageMediaType | DocumentMediaType;

/**
 * Build message content for image files
 */
function buildImageContent(data: string, mediaType: ImageMediaType) {
  return [
    {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: mediaType,
        data: data,
      },
    },
    {
      type: 'text' as const,
      text: 'Please extract all receipt data from this image and return it as JSON.',
    },
  ];
}

/**
 * Build message content for PDF files
 */
function buildPdfContent(data: string) {
  return [
    {
      type: 'document' as const,
      source: {
        type: 'base64' as const,
        media_type: 'application/pdf' as const,
        data: data,
      },
    },
    {
      type: 'text' as const,
      text: 'Please extract all receipt data from this PDF document and return it as JSON.',
    },
  ];
}

/**
 * Extract data from a receipt image or PDF using Claude Vision API
 * @param data - Base64 encoded data
 * @param mediaType - MIME type of the file
 * @returns Extracted receipt data
 */
export async function extractReceiptData(
  data: string,
  mediaType: SupportedMediaType
): Promise<OCRResult> {
  try {
    // Build the content based on whether it's an image or PDF
    const isPdf = mediaType === 'application/pdf';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = isPdf
      ? buildPdfContent(data)
      : buildImageContent(data, mediaType as ImageMediaType);

    const response = await getAnthropicClient().messages.create({
      model: getModel(),
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude Vision API');
    }

    // Parse JSON response
    const jsonText = textContent.text.trim();

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
      lineItems: Array.isArray(result.lineItems) ? result.lineItems.map((item: any) => ({
        description: item.description || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : undefined,
        total: typeof item.total === 'number' ? item.total : 0,
      })) : [],
      confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
    };
  } catch (error) {
    // Handle specific Anthropic API errors
    if (error instanceof Anthropic.APIError) {
      throw new OCRServiceError(
        `API_ERROR_${error.status}`,
        `Claude Vision API error: ${error.message}`
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      throw new OCRServiceError(
        'PARSE_ERROR',
        'Failed to parse OCR response as JSON'
      );
    }

    // Re-throw other errors
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
 * @param filePath - Path to the receipt file
 * @param mimeType - MIME type of the file
 * @returns Extracted receipt data
 */
export async function extractReceiptDataFromFile(
  filePath: string,
  mimeType: string
): Promise<OCRResult> {
  const { readFile } = await import('fs/promises');

  try {
    // Read the file
    const buffer = await readFile(filePath);
    const base64 = buffer.toString('base64');

    // Map content type to supported media type
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

    return extractReceiptData(base64, mediaType);
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
    // Try parsing as ISO date
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
  return !!(settings.ai?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY);
}

/**
 * Process a receipt with retry logic
 * @param filePath - Path to the receipt file
 * @param mimeType - MIME type of the file
 * @param maxRetries - Maximum number of retry attempts (default 3)
 * @returns Extracted receipt data
 */
export async function processReceiptWithRetry(
  filePath: string,
  mimeType: string,
  maxRetries: number = 3
): Promise<OCRResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extractReceiptDataFromFile(filePath, mimeType);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retriable errors
      if (error instanceof OCRServiceError) {
        const nonRetriableErrors = ['UNSUPPORTED_TYPE', 'FILE_READ_ERROR', 'PARSE_ERROR'];
        if (nonRetriableErrors.includes(error.code)) {
          throw error;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new OCRServiceError('MAX_RETRIES', 'Maximum retry attempts exceeded');
}
