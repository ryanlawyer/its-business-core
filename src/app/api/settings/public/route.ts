import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

/**
 * GET /api/settings/public - Get public system settings
 * No auth required — used by login page, navbar, and favicon
 */
export async function GET(req: NextRequest) {
  try {
    const settings = getSettings();

    return NextResponse.json({
      organization: {
        name: settings.organization.name,
        logo: settings.organization.logo,
        favicon: settings.organization?.favicon ?? null,
      },
      appearance: {
        theme: settings.appearance?.theme ?? 'midnight-precision',
      },
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}
