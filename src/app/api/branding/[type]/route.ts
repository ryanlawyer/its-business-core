import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { resolveUploadPath } from '@/lib/file-utils';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * GET /api/branding/[type] — Serve logo or favicon (public, no auth)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;

    if (type !== 'logo' && type !== 'favicon') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const settings = getSettings();
    const filePath = type === 'logo'
      ? settings.organization.logo
      : settings.organization?.favicon;

    if (!filePath) {
      return NextResponse.json({ error: 'No custom branding set' }, { status: 404 });
    }

    const absolutePath = resolveUploadPath(filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(absolutePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error('Error serving branding:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
