import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getUserWithPermissions, hasPermission } from '@/lib/check-permissions';
import { resolveUploadPath } from '@/lib/file-utils';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileTypeFromFile } from 'file-type';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/receipts/[id]/image
 * Serve the receipt image file
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPerms = await getUserWithPermissions(session.user.id);
    if (!userWithPerms) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user, permissions } = userWithPerms;

    // Fetch the receipt
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canViewAll = hasPermission(permissions, 'receipts', 'canViewAll');
    const canViewOwn = hasPermission(permissions, 'receipts', 'canViewOwn');
    const isOwner = receipt.userId === user.id;

    if (!canViewAll && !(canViewOwn && isOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine which file to serve
    const { searchParams } = new URL(req.url);
    const thumbnail = searchParams.get('thumbnail') === 'true';
    const filePath = thumbnail && receipt.thumbnailUrl
      ? receipt.thumbnailUrl
      : receipt.imageUrl;

    if (!filePath) {
      return NextResponse.json(
        { error: 'No image available' },
        { status: 404 }
      );
    }

    // Resolve and validate the file path to prevent path traversal
    const resolvedPath = resolveUploadPath(filePath);
    if (!resolvedPath) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    if (!existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: 'Image file not found' },
        { status: 404 }
      );
    }

    // Read the file
    const buffer = await readFile(resolvedPath);

    // Detect content type
    const fileType = await fileTypeFromFile(resolvedPath);
    const contentType = fileType?.mime || 'application/octet-stream';

    // Return the image with proper headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    console.error('Error serving receipt image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
