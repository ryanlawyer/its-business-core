import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';
import { getAIProvider, AINotConfiguredError } from '@/lib/ai';

/**
 * POST /api/settings/test-ai
 * Test the current AI provider connection
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'settings', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const provider = await getAIProvider();
    const result = await provider.testConnection();

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { success: false, message: 'No AI provider is configured.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error testing AI connection',
      },
      { status: 500 },
    );
  }
}
