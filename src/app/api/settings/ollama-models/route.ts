import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getPermissionsFromSession, hasPermission } from '@/lib/check-permissions';

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

/**
 * GET /api/settings/ollama-models?baseUrl=http://localhost:11434
 * Fetch available models from an Ollama server
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perms = getPermissionsFromSession(session);
    if (!perms || !hasPermission(perms.permissions, 'settings', 'canManage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = request.nextUrl.searchParams.get('baseUrl');
    if (!baseUrl) {
      return NextResponse.json(
        { models: [], error: 'baseUrl query parameter is required' },
        { status: 400 },
      );
    }

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      return NextResponse.json(
        { models: [], error: 'Invalid base URL format' },
        { status: 400 },
      );
    }

    // Fetch models from Ollama with a 5-second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json({
          models: [],
          error: `Ollama returned status ${res.status}`,
        });
      }

      const data = await res.json();
      const models = (data.models || []).map((m: OllamaModel) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        details: m.details
          ? {
              family: m.details.family,
              parameterSize: m.details.parameter_size,
              quantizationLevel: m.details.quantization_level,
            }
          : undefined,
      }));

      return NextResponse.json({ models });
    } catch (err) {
      clearTimeout(timeout);
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Connection timed out after 5 seconds'
          : err instanceof Error
            ? err.message
            : 'Failed to connect to Ollama';

      return NextResponse.json({ models: [], error: message });
    }
  } catch {
    return NextResponse.json(
      { models: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
