/**
 * Currency utilities for multi-currency receipt support
 */

// Supported currencies
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

// Default base currency for reporting
export const BASE_CURRENCY: CurrencyCode = 'USD';

// Exchange rate cache (in-memory, refreshed periodically)
interface ExchangeRateCache {
  rates: Record<string, number>;
  timestamp: number;
  baseCurrency: string;
}

let exchangeRateCache: ExchangeRateCache | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch exchange rates from a free API
 * Using exchangerate-api.com free tier (1500 requests/month)
 */
export async function fetchExchangeRates(baseCurrency: string = BASE_CURRENCY): Promise<Record<string, number>> {
  // Check cache first
  if (
    exchangeRateCache &&
    exchangeRateCache.baseCurrency === baseCurrency &&
    Date.now() - exchangeRateCache.timestamp < CACHE_TTL
  ) {
    return exchangeRateCache.rates;
  }

  try {
    // Using the free open exchange rates API
    // In production, you'd want to use a paid service with better reliability
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.status}`);
    }

    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('Exchange rate API returned error');
    }

    // Cache the rates
    exchangeRateCache = {
      rates: data.rates,
      timestamp: Date.now(),
      baseCurrency,
    };

    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);

    // Return fallback rates if API fails
    // These are approximate rates and should only be used as fallback
    return getFallbackRates(baseCurrency);
  }
}

/**
 * Fallback exchange rates (approximate, for when API is unavailable)
 */
function getFallbackRates(baseCurrency: string): Record<string, number> {
  // Rates as of a recent date, relative to USD
  const usdRates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.53,
    JPY: 149.5,
    CHF: 0.88,
    CNY: 7.24,
    INR: 83.1,
    MXN: 17.1,
    BRL: 4.97,
    KRW: 1330,
  };

  if (baseCurrency === 'USD') {
    return usdRates;
  }

  // Convert rates to be relative to the specified base currency
  const baseRate = usdRates[baseCurrency] || 1;
  const convertedRates: Record<string, number> = {};

  for (const [currency, rate] of Object.entries(usdRates)) {
    convertedRates[currency] = rate / baseRate;
  }

  return convertedRates;
}

/**
 * Convert an amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; rate: number }> {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, rate: 1 };
  }

  const rates = await fetchExchangeRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
  }

  return {
    convertedAmount: Math.round(amount * rate * 100) / 100,
    rate,
  };
}

/**
 * Convert amount to base currency
 */
export async function convertToBaseCurrency(
  amount: number,
  fromCurrency: string,
  baseCurrency: string = BASE_CURRENCY
): Promise<{ convertedAmount: number; rate: number }> {
  return convertCurrency(amount, fromCurrency, baseCurrency);
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
  return currency?.symbol || currencyCode;
}

/**
 * Parse currency from OCR text
 * Attempts to detect currency from common patterns
 */
export function detectCurrencyFromText(text: string): CurrencyCode | null {
  const patterns: Array<{ pattern: RegExp; currency: CurrencyCode }> = [
    { pattern: /\$\s*[\d,]+\.?\d*/i, currency: 'USD' },
    { pattern: /USD\s*[\d,]+\.?\d*/i, currency: 'USD' },
    { pattern: /€\s*[\d,]+\.?\d*/i, currency: 'EUR' },
    { pattern: /EUR\s*[\d,]+\.?\d*/i, currency: 'EUR' },
    { pattern: /£\s*[\d,]+\.?\d*/i, currency: 'GBP' },
    { pattern: /GBP\s*[\d,]+\.?\d*/i, currency: 'GBP' },
    { pattern: /¥\s*[\d,]+\.?\d*/i, currency: 'JPY' },
    { pattern: /JPY\s*[\d,]+\.?\d*/i, currency: 'JPY' },
    { pattern: /C\$\s*[\d,]+\.?\d*/i, currency: 'CAD' },
    { pattern: /CAD\s*[\d,]+\.?\d*/i, currency: 'CAD' },
    { pattern: /A\$\s*[\d,]+\.?\d*/i, currency: 'AUD' },
    { pattern: /AUD\s*[\d,]+\.?\d*/i, currency: 'AUD' },
  ];

  for (const { pattern, currency } of patterns) {
    if (pattern.test(text)) {
      return currency;
    }
  }

  return null;
}
