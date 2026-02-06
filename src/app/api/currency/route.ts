import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { fetchExchangeRates, convertCurrency, SUPPORTED_CURRENCIES, BASE_CURRENCY } from '@/lib/currency';

/**
 * GET /api/currency
 * Get supported currencies and exchange rates
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const baseCurrency = searchParams.get('base') || BASE_CURRENCY;

    // Validate currency code format (must be exactly 3 uppercase letters)
    if (!/^[A-Z]{3}$/.test(baseCurrency)) {
      return NextResponse.json(
        { error: 'Invalid currency code. Must be 3 uppercase letters.' },
        { status: 400 }
      );
    }

    // Fetch current exchange rates
    const rates = await fetchExchangeRates(baseCurrency);

    return NextResponse.json({
      baseCurrency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      rates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching currency data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/currency
 * Convert an amount between currencies
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, fromCurrency, toCurrency } = body;

    if (typeof amount !== 'number' || !fromCurrency || !toCurrency) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, fromCurrency, toCurrency' },
        { status: 400 }
      );
    }

    // Validate currency code formats
    if (!/^[A-Z]{3}$/.test(fromCurrency) || !/^[A-Z]{3}$/.test(toCurrency)) {
      return NextResponse.json(
        { error: 'Invalid currency code. Must be 3 uppercase letters.' },
        { status: 400 }
      );
    }

    const result = await convertCurrency(amount, fromCurrency, toCurrency);

    return NextResponse.json({
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: result.convertedAmount,
      targetCurrency: toCurrency,
      exchangeRate: result.rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
