import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSettings } from '@/lib/settings';

/**
 * GET /api/settings/public - Get public system settings (organization name, logo)
 * Available to all authenticated users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = getSettings();

    // Only return public information
    return NextResponse.json({
      organization: {
        name: settings.organization.name,
        logo: settings.organization.logo,
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
